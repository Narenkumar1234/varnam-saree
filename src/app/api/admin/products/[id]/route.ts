import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { products } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/admin-session';
import { productInteger } from '@/lib/product-input';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminSession(req);
  if (denied) return denied;
  try {
    const { id } = await params;
    const numId = parseInt(id, 10);
    const body = await req.json();

    const updateData: any = {};
    try {
      if (body.stock !== undefined) updateData.stock = productInteger(body.stock, 0);
      if (body.price !== undefined) updateData.price = productInteger(body.price, 1);
      if (body.oldPrice !== undefined) updateData.oldPrice = body.oldPrice == null || body.oldPrice === '' ? null : productInteger(body.oldPrice, 1);
    } catch {
      return NextResponse.json({ error: 'Price must be a positive whole rupee amount and stock a non-negative whole number.' }, { status: 400 });
    }
    if (body.name !== undefined) updateData.name = body.name;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.collection !== undefined) updateData.collection = body.collection;
    if (body.colour !== undefined) updateData.colour = body.colour;
    if (body.tag !== undefined) updateData.tag = body.tag;
    if (body.image !== undefined) updateData.image = body.image;
    if (body.description !== undefined) updateData.description = body.description;

    const updated = await db
      .update(products)
      .set(updateData)
      .where(eq(products.id, numId))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, product: updated[0] });
  } catch (error: any) {
    console.error('Failed to update product in database:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireAdminSession(req);
  if (denied) return denied;
  try {
    const { id } = await params;
    const numId = parseInt(id, 10);

    await db.delete(products).where(eq(products.id, numId));
    return NextResponse.json({ success: true, message: 'Product removed' });
  } catch (error: any) {
    console.error('Failed to delete product:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
