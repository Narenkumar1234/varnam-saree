import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, customerName, email, phone, address, city, state, pincode, total, items, uid } = body;

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
        id: id || `VS-${Math.floor(1000 + Math.random() * 9000)}`,
        userId: dbUserId,
        customerName: customerName || 'Varnam Patron',
        email: email || 'order@varnamsaree.com',
        phone: phone || '',
        address: address || '',
        city: city || '',
        state: state || '',
        pincode: pincode || '',
        total: total || 0,
        status: 'Confirmed',
        itemsJson: JSON.stringify(items || []),
      })
      .returning();

    return NextResponse.json({ success: true, order: newOrder[0] });
  } catch (error: any) {
    console.error('Failed to create order in database:', error);
    return NextResponse.json(
      { error: 'Failed to record order in database.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

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

    return NextResponse.json({ orders: result });
  } catch (error: any) {
    console.error('Failed to fetch orders from database:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders from database.' },
      { status: 500 }
    );
  }
}
