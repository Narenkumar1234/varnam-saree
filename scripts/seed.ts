import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../src/db/schema';
import { requireDatabaseEnvironment } from '../src/db/config';
import { seedCatalogue } from '../src/db/seed-catalogue';
import { seedCommerce } from '../src/db/seed-commerce';

const pool = new Pool(requireDatabaseEnvironment(true));
try {
  await seedCatalogue(drizzle(pool, { schema }));
  await seedCommerce(drizzle(pool, { schema }));
  console.log('Catalogue, coupons and site settings seeded. Existing Studio edits and coupon deletions were preserved.');
} finally { await pool.end(); }
