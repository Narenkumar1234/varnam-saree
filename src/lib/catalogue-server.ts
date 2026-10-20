import { db } from '@/db';
import { products } from '@/db/schema';
import { fallbackProducts } from '@/data/products';
import { normalizeProductImages } from '@/lib/product-gallery';
import type { Product } from '@/types';

export interface Catalogue { products: Product[]; source: 'database' | 'fallback' }

// No persistent cache: Studio edits are visible on the next catalogue request.
export async function getCatalogue(): Promise<Catalogue> {
  try {
    const rows = await db.select().from(products).orderBy(products.id);
    if (rows.length) {
      return { source: 'database', products: rows.map((row) => {
        const images = normalizeProductImages(row.images).slice(0, 3);
        let variants: Product['variants'] | undefined;
        if ((row as any).variants) {
          try {
            const raw = (row as any).variants;
            const parsed = typeof raw === 'string' && raw.trim().startsWith('[')
              ? JSON.parse(raw)
              : (Array.isArray(raw) ? raw : null);
            if (Array.isArray(parsed)) {
              variants = parsed
                .filter((v: any) => v && typeof v === 'object' && (v.name || v.colour))
                .map((v: any) => ({
                  name: String(v.name || v.colour || '').trim(),
                  colour: String(v.colour || v.name || '').trim(),
                  ...(typeof v.hex === 'string' && v.hex.trim() ? { hex: v.hex.trim() } : {}),
                  images: normalizeProductImages(v.images).slice(0, 3),
                }));
            }
          } catch {
            variants = undefined;
          }
        }
        return {
          id: row.id, name: row.name, type: row.type, collection: row.collection,
          price: row.price, oldPrice: row.oldPrice, colour: row.colour,
          stock: row.stock, tag: row.tag || '',
          image: images[0] || row.image,
          description: row.description || '',
          ...(images.length > 0 ? { images } : {}),
          ...(variants && variants.length > 0 ? { variants } : {}),
        };
      }) };
    }
  } catch {
    // Empty/unreachable databases use the same catalogue in the UI and pricing.
  }
  return { products: fallbackProducts.map((product) => ({ ...product })), source: 'fallback' };
}
