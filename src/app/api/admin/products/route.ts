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
    const { name, type, collection, price, oldPrice, discountPercentage, colour, stock, tag, image, images, description } = body;

    if (!name || !type || !collection || !price || !colour) {
      return NextResponse.json({ error: 'Missing required saree fields' }, { status: 400 });
    }
    let numbers;
    try {
      let parsedOldPrice = oldPrice == null || oldPrice === '' ? null : productInteger(oldPrice, 1);
      let parsedPrice = productInteger(price, 1);
      if (discountPercentage != null && discountPercentage !== '') {
        const disc = typeof discountPercentage === 'number' ? discountPercentage : parseInt(discountPercentage, 10);
        if (!isNaN(disc) && disc > 0 && disc < 100) {
          if (parsedOldPrice) {
            parsedPrice = Math.max(1, Math.round(parsedOldPrice * (1 - disc / 100)));
          } else if (parsedPrice) {
            parsedOldPrice = Math.round(parsedPrice / (1 - disc / 100));
          }
        }
      }
      numbers = { price: parsedPrice, stock: stock !== undefined ? productInteger(stock, 0) : 5, oldPrice: parsedOldPrice };
    } catch {
      return NextResponse.json({ error: 'Price must be a positive whole rupee amount and stock a non-negative whole number.' }, { status: 400 });
    }

    let cleanImages: string[] = [];
    if (Array.isArray(images)) {
      cleanImages = images.filter((img) => typeof img === 'string' && img.trim().length > 0 && !img.trim().startsWith('blob:')).slice(0, 3);
    } else if (typeof images === 'string' && images.trim().length > 0) {
      try {
        if (images.trim().startsWith('[')) {
          const parsed = JSON.parse(images);
          if (Array.isArray(parsed)) {
            cleanImages = parsed.filter((img) => typeof img === 'string' && img.trim().length > 0 && !img.trim().startsWith('blob:')).slice(0, 3);
          }
        } else {
          cleanImages = images.split(',').map((s) => s.trim()).filter((s) => Boolean(s) && !s.startsWith('blob:')).slice(0, 3);
        }
      } catch {
        cleanImages = [];
      }
    }
    const safeImage = (typeof image === 'string' && !image.trim().startsWith('blob:')) ? image.trim() : null;
    const primaryImage = cleanImages[0] || safeImage || '/assets/saree-emerald.webp';
    if (cleanImages.length === 0 && primaryImage) {
      cleanImages = [primaryImage];
    }

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
        image: primaryImage,
        images: cleanImages.length > 0 ? JSON.stringify(cleanImages) : null,
        variants: cleanVariants.length > 0 ? JSON.stringify(cleanVariants) : null,
        description: description || '',
      })
      .returning();

    return NextResponse.json({ success: true, product: created[0] });
  } catch (error: any) {
    console.error('Failed to create product:', error);
    return NextResponse.json({ error: 'Failed to create product in database' }, { status: 500 });
  }
}
