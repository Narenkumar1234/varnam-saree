import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { products } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = requireAdminSession(req);
  if (denied) return denied;
  try {
    const list = await db.select().from(products).orderBy(desc(products.id));
    return NextResponse.json({ products: list }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    console.error('Failed to fetch admin products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = requireAdminSession(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { name, type, collection, price, oldPrice, colour, stock, tag, image, description } = body;

    if (!name || !type || !collection || !price || !colour) {
      return NextResponse.json({ error: 'Missing required saree fields' }, { status: 400 });
    }

    const created = await db
      .insert(products)
      .values({
        name,
        type,
        collection,
        price: parseInt(price, 10),
        oldPrice: oldPrice ? parseInt(oldPrice, 10) : null,
        colour,
        stock: stock !== undefined ? parseInt(stock, 10) : 5,
        tag: tag || null,
        image: image || '/assets/saree-emerald.webp',
        description: description || '',
      })
      .returning();

    return NextResponse.json({ success: true, product: created[0] });
  } catch (error: any) {
    console.error('Failed to create product:', error);
    return NextResponse.json({ error: 'Failed to create product in database' }, { status: 500 });
  }
}
