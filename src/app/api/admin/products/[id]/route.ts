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

      if (body.discountPercentage !== undefined && body.discountPercentage !== null && body.discountPercentage !== '') {
        const disc = typeof body.discountPercentage === 'number' ? body.discountPercentage : parseInt(body.discountPercentage, 10);
        if (!isNaN(disc) && disc > 0 && disc < 100) {
          if (updateData.oldPrice) {
            updateData.price = Math.max(1, Math.round(updateData.oldPrice * (1 - disc / 100)));
          } else if (updateData.price) {
            updateData.oldPrice = Math.round(updateData.price / (1 - disc / 100));
          } else {
            const existingRows = await db.select().from(products).where(eq(products.id, numId));
            if (existingRows.length > 0) {
              const currentOld = existingRows[0].oldPrice;
              const currentPrice = existingRows[0].price;
              if (currentOld) {
                updateData.price = Math.max(1, Math.round(currentOld * (1 - disc / 100)));
              } else {
                updateData.oldPrice = Math.round(currentPrice / (1 - disc / 100));
              }
            }
          }
        } else if (disc === 0 && body.oldPrice === undefined) {
          updateData.oldPrice = null;
        }
      }
    } catch {
      return NextResponse.json({ error: 'Price must be a positive whole rupee amount and stock a non-negative whole number.' }, { status: 400 });
    }
    if (body.images !== undefined) {
      let cleanImages: string[] = [];
      if (Array.isArray(body.images)) {
        cleanImages = body.images.filter((img: any) => typeof img === 'string' && img.trim().length > 0 && !img.trim().startsWith('blob:')).slice(0, 3);
      } else if (typeof body.images === 'string' && body.images.trim().length > 0) {
        try {
          if (body.images.trim().startsWith('[')) {
            const parsed = JSON.parse(body.images);
            if (Array.isArray(parsed)) {
              cleanImages = parsed.filter((img: any) => typeof img === 'string' && img.trim().length > 0 && !img.trim().startsWith('blob:')).slice(0, 3);
            }
          } else {
            cleanImages = body.images.split(',').map((s: string) => s.trim()).filter((s: string) => Boolean(s) && !s.startsWith('blob:')).slice(0, 3);
          }
        } catch {
          cleanImages = [];
        }
      }
      updateData.images = cleanImages.length > 0 ? JSON.stringify(cleanImages) : null;
      if (body.image === undefined && cleanImages.length > 0) {
        updateData.image = cleanImages[0];
      }
    }
    if (body.variants !== undefined) {
      let cleanVariants: { name: string; colour?: string; images: string[] }[] = [];
      if (Array.isArray(body.variants)) {
        cleanVariants = body.variants
          .filter((v: any) => v && typeof v === 'object' && (v.name || v.colour))
          .map((v: any) => ({
            name: String(v.name || v.colour || '').trim(),
            colour: String(v.colour || v.name || '').trim(),
            images: Array.isArray(v.images)
              ? v.images.filter((img: any) => typeof img === 'string' && img.trim().length > 0 && !img.trim().startsWith('blob:')).slice(0, 3)
              : [],
          }));
      } else if (typeof body.variants === 'string' && body.variants.trim().length > 0) {
        try {
          const parsed = JSON.parse(body.variants);
          if (Array.isArray(parsed)) {
            cleanVariants = parsed
              .filter((v: any) => v && typeof v === 'object' && (v.name || v.colour))
              .map((v: any) => ({
                name: String(v.name || v.colour || '').trim(),
                colour: String(v.colour || v.name || '').trim(),
                images: Array.isArray(v.images)
                  ? v.images.filter((img: any) => typeof img === 'string' && img.trim().length > 0 && !img.trim().startsWith('blob:')).slice(0, 3)
                  : [],
              }));
          }
        } catch {
          cleanVariants = [];
        }
      }
      updateData.variants = cleanVariants.length > 0 ? JSON.stringify(cleanVariants) : null;
    }
    if (body.name !== undefined) updateData.name = body.name;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.collection !== undefined) updateData.collection = body.collection;
    if (body.colour !== undefined) updateData.colour = typeof body.colour === 'string' ? body.colour.trim() : body.colour;
    if (body.tag !== undefined) updateData.tag = body.tag;
    if (body.image !== undefined && typeof body.image === 'string' && !body.image.trim().startsWith('blob:')) updateData.image = body.image.trim();
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
