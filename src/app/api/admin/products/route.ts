import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { products } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/admin-session';
import { productInteger } from '@/lib/product-input';

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
    let numbers;
    try {
      numbers = { price: productInteger(price, 1), stock: stock !== undefined ? productInteger(stock, 0) : 5, oldPrice: oldPrice == null || oldPrice === '' ? null : productInteger(oldPrice, 1) };
    } catch {
      return NextResponse.json({ error: 'Price must be a positive whole rupee amount and stock a non-negative whole number.' }, { status: 400 });
    }

    const created = await db
      .insert(products)
      .values({
        name,
        type,
        collection,
        price: numbers.price,
        oldPrice: numbers.oldPrice,
        colour,
        stock: numbers.stock,
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
