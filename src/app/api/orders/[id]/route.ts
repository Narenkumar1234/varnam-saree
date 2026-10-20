import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { toPublicTrackedOrder, trackedOrderNeedsCatalogue } from '@/lib/order-lookup';
import { getCatalogue } from '@/lib/catalogue-server';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const found = await db.select().from(orders).where(eq(orders.id, id)).limit(1);

    if (found.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404, headers: noStore });
    }

    // Older orders have no stored thumbnail; only then load the live catalogue to fill one in.
    const catalogue = trackedOrderNeedsCatalogue(found[0]) ? (await getCatalogue()).products : undefined;
    return NextResponse.json({ order: toPublicTrackedOrder(found[0], catalogue) }, { headers: noStore });
  } catch (error: any) {
    console.error('Failed to lookup order in database:', error);
    return NextResponse.json(
      { error: 'Failed to lookup order' },
      { status: 500, headers: noStore }
    );
  }
}
