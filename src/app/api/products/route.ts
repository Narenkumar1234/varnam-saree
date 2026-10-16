import { NextResponse } from 'next/server';
import { db } from '@/db';
import { products } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { products as fallbackProducts } from '@/data/products';

export async function GET() {
  try {
    const dbProducts = await db.select().from(products).orderBy(products.id);

    if (dbProducts.length === 0) {
      return NextResponse.json({ products: fallbackProducts });
    }

    const formatted = dbProducts.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      collection: p.collection,
      price: p.price,
      old: p.oldPrice || undefined,
      colour: p.colour,
      stock: p.stock,
      tag: p.tag || '',
      image: p.image,
      description: p.description || '',
    }));

    return NextResponse.json({ products: formatted });
  } catch (error: any) {
    console.error('Failed to load products from database:', error);
    return NextResponse.json({ products: fallbackProducts });
  }
}
