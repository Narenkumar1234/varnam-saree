import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { configuredAdminEmail, requireAdminSession } from '@/lib/admin-session';
import { readOrderSnapshot } from '@/lib/order-pricing';
import {
  createOfflinePaidPayment,
  isOfflinePaymentMethod,
  normalizeOfflinePaymentNote,
  offlineMarkPaidBlocked,
  offlineMarkUnpaidBlocked,
  offlineTelegramPaymentStatus,
  UNREADABLE_ORDER_DATA_ERROR,
  writePaymentSnapshot,
} from '@/lib/offline-payment';
import {
  adminStatusChangeError,
  deriveOrderStatusFromPayment,
  normalizeOrderLookupId,
} from '@/lib/order-status';
import { notifyAdminsOfOrder } from '@/lib/telegram';

async function findAdminOrder(id: string) {
  const [exact] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (exact) return exact;
  if (id.toLowerCase() === id) return null;
  const [folded] = await db.select().from(orders).where(sql`lower(${orders.id}) = ${id.toLowerCase()}`).limit(1);
  return folded ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminSession(req);
  if (denied) return denied;
  const { id: rawId } = await params;
  const id = normalizeOrderLookupId(rawId);
  if (!id) {
    return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
  }
  try {
    const order = await findAdminOrder(id);
    if (!order) {
      return NextResponse.json({ error: 'No order found' }, { status: 404 });
    }
    return NextResponse.json(
      { order: { ...order, ...readOrderSnapshot(order.itemsJson) } },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'Unable to load order.' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminSession(req);
  if (denied) return denied;
  try {
    const { id: rawId } = await params;
    const id = normalizeOrderLookupId(rawId);
    if (!id) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }
    const body = await req.json();
    const requestedStatus = typeof body?.status === 'string' ? body.status.trim() : '';
    const paymentAction = body?.payment;

    if (!requestedStatus && paymentAction == null) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const order = await findAdminOrder(id);
    if (!order) {
      return NextResponse.json({ error: 'No order found' }, { status: 404 });
    }

    const currentPayment = readOrderSnapshot(order.itemsJson).payment;
    const updates: { status?: string; itemsJson?: string } = {};
    let nextPayment = currentPayment;

    if (paymentAction != null) {
      if (paymentAction.action === 'mark-offline-paid') {
        const blocked = offlineMarkPaidBlocked(order.status, currentPayment);
        if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });
        if (!isOfflinePaymentMethod(paymentAction.method)) {
          return NextResponse.json({ error: 'Choose a valid offline payment method.' }, { status: 400 });
        }
        const note = normalizeOfflinePaymentNote(paymentAction.note);
        if (note == null) {
          return NextResponse.json({ error: 'Reference note is too long.' }, { status: 400 });
        }
        const adminEmail = configuredAdminEmail();
        if (!adminEmail) {
          return NextResponse.json({ error: 'Admin login is not configured.' }, { status: 503 });
        }
        nextPayment = createOfflinePaidPayment({
          method: paymentAction.method,
          note: note || undefined,
          adminEmail,
        });
        updates.itemsJson = writePaymentSnapshot(order.itemsJson, nextPayment);
        updates.status = deriveOrderStatusFromPayment(order.status, nextPayment);
      } else if (paymentAction.action === 'mark-unpaid') {
        const blocked = offlineMarkUnpaidBlocked(order.status, currentPayment);
        if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });
        nextPayment = undefined;
        updates.itemsJson = writePaymentSnapshot(order.itemsJson, null);
        updates.status = deriveOrderStatusFromPayment(order.status, nextPayment);
      } else {
        return NextResponse.json({ error: 'Unknown payment action.' }, { status: 400 });
      }
    }

    if (requestedStatus) {
      const blocked = adminStatusChangeError(updates.status ?? order.status, requestedStatus, nextPayment);
      if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });
      updates.status = requestedStatus;
    }

    const updated = await db
      .update(orders)
      .set(updates)
      .where(eq(orders.id, order.id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ error: 'No order found' }, { status: 404 });
    }

    if (paymentAction?.action === 'mark-offline-paid' && isOfflinePaymentMethod(paymentAction.method)) {
      try {
        await notifyAdminsOfOrder({
          ...updated[0],
          paymentStatus: offlineTelegramPaymentStatus(paymentAction.method),
        });
      } catch {
        // Telegram is best-effort and must never fail the Studio payment write.
      }
    }

    return NextResponse.json({ success: true, order: updated[0] });
  } catch (error: unknown) {
    console.error('Failed to update order:', error);
    if (error instanceof Error && error.message === UNREADABLE_ORDER_DATA_ERROR) {
      return NextResponse.json({ error: UNREADABLE_ORDER_DATA_ERROR }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
  }
}
