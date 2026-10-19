import { sql } from 'drizzle-orm';
import { products } from './schema';
import { fallbackProducts } from '../data/products';
import type { db } from './index';

export async function seedCatalogue(database: typeof db) {
  await database.transaction(async (tx) => {
    await tx.execute(sql`lock table products in share row exclusive mode`);
    await tx.insert(products).values(fallbackProducts.map((product) => ({
      id: product.id, name: product.name, type: product.type,
      collection: product.collection, price: product.price,
      oldPrice: product.oldPrice ?? null, colour: product.colour,
      stock: product.stock ?? 5, tag: product.tag || null,
      image: product.image,
      images: product.images ? JSON.stringify(product.images) : null,
      variants: (product as any).variants ? JSON.stringify((product as any).variants) : null,
      description: product.description || '',
    }))).onConflictDoNothing({ target: products.id });
    // Explicit seed IDs must not make the next Studio insert reuse ID 1.
    await tx.execute(sql`select setval(pg_get_serial_sequence('products', 'id'), greatest((select coalesce(max(id), 1) from products), coalesce(pg_sequence_last_value(pg_get_serial_sequence('products', 'id')::regclass), 1)), true)`);
  });
}
