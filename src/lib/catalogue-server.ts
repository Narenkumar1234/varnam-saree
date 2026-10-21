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
        // Colour variants stay in the DB (untouched) but are not exposed to the storefront.
        return {
          id: row.id, name: row.name, type: row.type, collection: row.collection,
          price: row.price, oldPrice: row.oldPrice, colour: row.colour,
          stock: row.stock, tag: row.tag || '',
          image: images[0] || row.image,
          description: row.description || '',
          ...(images.length > 0 ? { images } : {}),
        };
      }) };
    }
  } catch {
    // Empty/unreachable databases use the same catalogue in the UI and pricing.
  }
  return { products: fallbackProducts.map((product) => ({ ...product })), source: 'fallback' };
}
