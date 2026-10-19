import { db } from '@/db';
import { products } from '@/db/schema';
import { fallbackProducts } from '@/data/products';
import type { Product } from '@/types';

export interface Catalogue { products: Product[]; source: 'database' | 'fallback' }

// No persistent cache: Studio edits are visible on the next catalogue request.
export async function getCatalogue(): Promise<Catalogue> {
  try {
    const rows = await db.select().from(products).orderBy(products.id);
    if (rows.length) {
      return { source: 'database', products: rows.map((row) => {
        let images: string[] | undefined;
        if (row.images) {
          try {
            const parsed = typeof row.images === 'string' && row.images.trim().startsWith('[')
              ? JSON.parse(row.images)
              : (Array.isArray(row.images) ? row.images : String(row.images).split(',').map((s) => s.trim()).filter(Boolean));
            if (Array.isArray(parsed) && parsed.length > 0) {
              images = parsed.filter((img: any) => typeof img === 'string' && img.trim().length > 0 && !img.startsWith('blob:')).slice(0, 3);
            }
          } catch {
            images = undefined;
          }
        }
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
                  images: Array.isArray(v.images)
                    ? v.images.filter((img: any) => typeof img === 'string' && img.trim().length > 0 && !img.startsWith('blob:')).slice(0, 3)
                    : [],
                }));
            }
          } catch {
            variants = undefined;
          }
        }
        return {
          id: row.id, name: row.name, type: row.type, collection: row.collection,
          price: row.price, oldPrice: row.oldPrice, colour: row.colour,
          stock: row.stock, tag: row.tag || '', image: row.image,
          description: row.description || '',
          ...(images && images.length > 0 ? { images } : {}),
          ...(variants && variants.length > 0 ? { variants } : {}),
        };
      }) };
    }
  } catch {
    // Empty/unreachable databases use the same catalogue in the UI and pricing.
  }
  return { products: fallbackProducts.map((product) => ({ ...product })), source: 'fallback' };
}
