import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { requireAdminSession } from '@/lib/admin-session';
import { readOrderSnapshot } from '@/lib/order-pricing';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = requireAdminSession(request);
  if (denied) return denied;
  try {
    const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(20);
    return NextResponse.json({ orders: rows.map((order) => ({ ...order, ...readOrderSnapshot(order.itemsJson) })) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load Studio orders.' }, { status: 500 });
  }
}
