import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { toPublicTrackedOrder } from '@/lib/order-lookup';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const found = await db.select().from(orders).where(eq(orders.id, id)).limit(1);

    if (found.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ order: toPublicTrackedOrder(found[0]) });
  } catch (error: any) {
    console.error('Failed to lookup order in database:', error);
    return NextResponse.json(
      { error: 'Failed to lookup order' },
      { status: 500 }
    );
  }
}
