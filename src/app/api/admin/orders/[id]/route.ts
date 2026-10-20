import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { configuredAdminEmail, requireAdminSession } from '@/lib/admin-session';
import { readOrderSnapshot } from '@/lib/order-pricing';
import {
  cancelledOrderBlocksOffline,
  createOfflinePaidPayment,
  isOfflinePaymentMethod,
  normalizeOfflinePaymentNote,
  offlinePaidRequiredToUndo,
  offlineTelegramPaymentStatus,
  razorpayPaidBlocksOffline,
  UNREADABLE_ORDER_DATA_ERROR,
  writePaymentSnapshot,
} from '@/lib/offline-payment';
import { notifyAdminsOfOrder } from '@/lib/telegram';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminSession(req);
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await req.json();
    const status = typeof body?.status === 'string' ? body.status.trim() : '';
    const paymentAction = body?.payment;

    if (!status && paymentAction == null) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const updates: { status?: string; itemsJson?: string } = {};
    if (status) updates.status = status;

    if (paymentAction != null) {
      const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      const current = readOrderSnapshot(order.itemsJson).payment;
      if (paymentAction.action === 'mark-offline-paid') {
        const cancelled = cancelledOrderBlocksOffline(status || order.status);
        if (cancelled) return NextResponse.json({ error: cancelled }, { status: 409 });
        const blocked = razorpayPaidBlocksOffline(current);
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
        updates.itemsJson = writePaymentSnapshot(order.itemsJson, createOfflinePaidPayment({
          method: paymentAction.method,
          note: note || undefined,
          adminEmail,
        }));
      } else if (paymentAction.action === 'mark-unpaid') {
        const blocked = offlinePaidRequiredToUndo(current);
        if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });
        updates.itemsJson = writePaymentSnapshot(order.itemsJson, null);
      } else {
        return NextResponse.json({ error: 'Unknown payment action.' }, { status: 400 });
      }
    }

    const updated = await db
      .update(orders)
      .set(updates)
      .where(eq(orders.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
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
