import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { calculateOrderQuote, parseOrderItems, readOrderSnapshot, serializeOrderQuote, OrderPricingError } from '@/lib/order-pricing';
import { requireAdminSession } from '@/lib/admin-session';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, customerName, email, phone, address, city, state, pincode, items, uid, couponCode } = body;
    if (couponCode != null && typeof couponCode !== 'string') {
      throw new OrderPricingError('Please enter a valid coupon code.');
    }
    const quote = calculateOrderQuote(parseOrderItems(items), couponCode);

    let dbUserId: number | null = null;
    if (uid) {
      const existingUser = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
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
    if (error instanceof OrderPricingError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to create order in database:', error);
    return NextResponse.json(
      { error: 'Your order could not be saved. Please try again.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    // The unfiltered list is an admin view. Customer email lookups retain the
    // existing storefront contract; Studio uses /api/admin/orders instead.
    if (!email) {
      const denied = requireAdminSession(req);
      if (denied) return denied;
    }

    let result;
    if (email) {
      result = await db
        .select()
        .from(orders)
        .where(eq(orders.email, email))
        .orderBy(desc(orders.createdAt));
    } else {
      result = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(20);
    }

    return NextResponse.json({ orders: result.map((order) => ({ ...order, ...readOrderSnapshot(order.itemsJson) })) });
  } catch (error: any) {
    console.error('Failed to fetch orders from database:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders from database.' },
      { status: 500 }
    );
  }
}
