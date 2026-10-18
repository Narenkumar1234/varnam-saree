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
      return { source: 'database', products: rows.map((row) => ({
        id: row.id, name: row.name, type: row.type, collection: row.collection,
        price: row.price, oldPrice: row.oldPrice, colour: row.colour,
        stock: row.stock, tag: row.tag || '', image: row.image,
        description: row.description || '',
      })) };
    }
  } catch {
    // Empty/unreachable databases use the same catalogue in the UI and pricing.
  }
  return { products: fallbackProducts.map((product) => ({ ...product })), source: 'fallback' };
}
