import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { AddressValidationError, parseCustomerAddressInput, parseOrderShipping } from '@/lib/address-validation';
import { saveCustomerAddress } from '@/lib/customer-address-store';
import { calculateOrderQuote, parseOrderItems, readOrderSnapshot, serializeOrderQuote, OrderPricingError } from '@/lib/order-pricing';
import { publicPaymentSnapshot } from '@/lib/order-status';
import { requireAdminSession } from '@/lib/admin-session';
import { requireCustomerIdentity, customerAuthFailure, customerPrivateHeaders, CustomerAuthError } from '@/lib/customer-auth-server';
import { localDemoModeEnabled } from '@/lib/local-demo-mode';
import { notifyAdminsOfOrder } from '@/lib/telegram';

export async function POST(req: NextRequest) {
  try {
    // Guests can order without authentication. A supplied token must verify; a
    // posted UID is never sufficient to associate an order with an account.
    const customer = req.headers.has('authorization') ? await requireCustomerIdentity(req) : null;
    const body = await req.json();
    const { id, email, items, couponCode } = body;
    if (couponCode != null && typeof couponCode !== 'string') {
      throw new OrderPricingError('Please enter a valid coupon code.');
    }
    const quote = await calculateOrderQuote(parseOrderItems(items), couponCode);
    if (body.expectedTotal != null && body.expectedTotal !== quote.pricing.total) {
      return NextResponse.json({ error: 'Prices have changed. Please review the updated total and place your order again.' }, { status: 409 });
    }
    const shipping = parseOrderShipping(body);
    const orderEmail = typeof email === 'string' && email.trim() ? email.trim() : (customer?.email || 'order@varnamsaree.com');

    // Opt-in local demo only (never in production): the order is NOT saved.
    if (localDemoModeEnabled()) {
      const orderId = id || `VRN-${crypto.randomUUID()}`;
      return NextResponse.json({
        success: true,
        order: {
          id: orderId,
          userId: null,
          email: orderEmail,
          total: quote.pricing.total,
          status: 'Payment pending',
          itemsJson: serializeOrderQuote(quote),
          createdAt: new Date().toISOString(),
          ...shipping,
          ...quote,
        },
      });
    }

    let dbUserId: number | null = null;
    if (customer) {
      const existingUser = await db.select().from(users).where(eq(users.uid, customer.uid)).limit(1);
      if (existingUser.length > 0) {
        dbUserId = existingUser[0].id;
        await db.update(users).set({ phone: shipping.phone }).where(eq(users.id, dbUserId));
      }
    }

    const newOrder = await db
      .insert(orders)
      .values({
        id: id || `VRN-${crypto.randomUUID()}`,
        userId: dbUserId,
        email: orderEmail,
        total: quote.pricing.total,
        status: 'Payment pending',
        itemsJson: serializeOrderQuote(quote),
        ...shipping,
      })
      .returning();

    if (dbUserId && body.saveAddress === true) {
      try {
        await saveCustomerAddress(dbUserId, parseCustomerAddressInput({
          ...shipping,
          label: body.addressLabel,
          fullName: shipping.shippingFullName,
          phone: shipping.shippingPhone,
          line1: shipping.shippingLine1,
          line2: shipping.shippingLine2,
          landmark: shipping.shippingLandmark,
          city: shipping.shippingCity,
          state: shipping.shippingState,
          pincode: shipping.shippingPincode,
          isDefault: body.saveAsDefault === true,
        }));
      } catch (error) {
        if (!(error instanceof AddressValidationError)) console.error('Failed to save checkout address:', error);
      }
    }

    await notifyAdminsOfOrder({ ...newOrder[0], ...quote, paymentStatus: 'pending payment' });
    return NextResponse.json({ success: true, order: { ...newOrder[0], ...quote } });
  } catch (error: any) {
    const denied = customerAuthFailure(error);
    if (denied) return denied;
    if (error instanceof OrderPricingError || error instanceof AddressValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to create order in database:', error);
    return NextResponse.json(
      { error: 'Your order could not be saved. Please try again.' },
      { status: 500, headers: customerPrivateHeaders }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (localDemoModeEnabled()) {
      if (!email && !req.headers.has('authorization')) {
        const denied = requireAdminSession(req);
        if (denied) return denied;
      } else {
        await requireCustomerIdentity(req);
      }
      return NextResponse.json({ orders: [] }, { headers: customerPrivateHeaders });
    }

    let result;
    if (!email && !req.headers.has('authorization')) {
      // Retain the legacy admin-only list; Studio uses /api/admin/orders.
      const denied = requireAdminSession(req);
      if (denied) return denied;
      result = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(20);
    } else {
      const customer = await requireCustomerIdentity(req);
      if (email && email !== customer.email) {
        throw new CustomerAuthError('You can only view orders for your signed-in Google account.', 403);
      }
      // A verified email also lets customers see their earlier guest purchases.
      // Never authorize from a query email or a legacy, client-supplied UID.
      result = await db.select().from(orders).where(eq(orders.email, customer.email)).orderBy(desc(orders.createdAt));
    }
    const customerList = Boolean(email || req.headers.has('authorization'));
    return NextResponse.json({
      orders: result.map((order) => {
        const snapshot = readOrderSnapshot(order.itemsJson);
        if (!customerList) return { ...order, ...snapshot };
        const { payment: storedPayment, ...safeSnapshot } = snapshot;
        const payment = publicPaymentSnapshot(storedPayment);
        return { ...order, ...safeSnapshot, ...(payment ? { payment } : {}) };
      }),
    }, { headers: customerPrivateHeaders });
  } catch (error: any) {
    const denied = customerAuthFailure(error);
    if (denied) return denied;
    console.error('Failed to fetch orders from database:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders from database.' },
      { status: 500, headers: customerPrivateHeaders }
    );
  }
}
