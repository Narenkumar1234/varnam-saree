import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../src/db/schema';
import { requireDatabaseEnvironment } from '../src/db/config';
import { seedCatalogue } from '../src/db/seed-catalogue';

const pool = new Pool(requireDatabaseEnvironment(true));
try {
  await seedCatalogue(drizzle(pool, { schema }));
  console.log('Catalogue seeded. Existing product IDs and Studio edits were preserved.');
} finally { await pool.end(); }
