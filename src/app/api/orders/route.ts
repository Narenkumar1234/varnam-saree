import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { calculateOrderQuote, parseOrderItems, readOrderSnapshot, serializeOrderQuote, OrderPricingError } from '@/lib/order-pricing';
import { requireAdminSession } from '@/lib/admin-session';
import { requireCustomerIdentity, customerAuthFailure, customerPrivateHeaders, CustomerAuthError } from '@/lib/customer-auth-server';
import { localDemoModeEnabled } from '@/lib/local-demo-mode';

export async function POST(req: NextRequest) {
  try {
    // Guests can order without authentication. A supplied token must verify; a
    // posted UID is never sufficient to associate an order with an account.
    const customer = req.headers.has('authorization') ? await requireCustomerIdentity(req) : null;
    const body = await req.json();
    const { id, customerName, email, phone, address, city, state, pincode, items, couponCode } = body;
    if (couponCode != null && typeof couponCode !== 'string') {
      throw new OrderPricingError('Please enter a valid coupon code.');
    }
    const quote = await calculateOrderQuote(parseOrderItems(items), couponCode);
    if (body.expectedTotal != null && body.expectedTotal !== quote.pricing.total) {
      return NextResponse.json({ error: 'Prices have changed. Please review the updated total and place your order again.' }, { status: 409 });
    }

    // Opt-in local demo only (never in production): the order is NOT saved.
    if (localDemoModeEnabled()) {
      const orderId = id || `VRN-${crypto.randomUUID()}`;
      return NextResponse.json({
        success: true,
        order: {
          id: orderId,
          userId: null,
          customerName: customerName || 'Varnam Patron',
          email: email || 'order@varnamsaree.com',
          phone: phone || '',
          address: address || '',
          city: city || '',
          state: state || '',
          pincode: pincode || '',
          total: quote.pricing.total,
          status: 'Confirmed',
          itemsJson: serializeOrderQuote(quote),
          createdAt: new Date().toISOString(),
          ...quote,
        },
      });
    }

    let dbUserId: number | null = null;
    if (customer) {
      const existingUser = await db.select().from(users).where(eq(users.uid, customer.uid)).limit(1);
      if (existingUser.length > 0) {
        dbUserId = existingUser[0].id;
      }
    }

    const newOrder = await db
      .insert(orders)
      .values({
        id: id || `VRN-${crypto.randomUUID()}`,
        userId: dbUserId,
        customerName: customerName || 'Varnam Patron',
        email: email || 'order@varnamsaree.com',
        phone: phone || '',
        address: address || '',
        city: city || '',
        state: state || '',
        pincode: pincode || '',
        total: quote.pricing.total,
        status: 'Confirmed',
        itemsJson: serializeOrderQuote(quote),
      })
      .returning();

    return NextResponse.json({ success: true, order: { ...newOrder[0], ...quote } });
  } catch (error: any) {
    const denied = customerAuthFailure(error);
    if (denied) return denied;
    if (error instanceof OrderPricingError) {
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
    return NextResponse.json({ orders: result.map((order) => ({ ...order, ...readOrderSnapshot(order.itemsJson) })) }, { headers: customerPrivateHeaders });
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
