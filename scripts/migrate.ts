import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { requireDatabaseEnvironment } from '../src/db/config';

const pool = new Pool(requireDatabaseEnvironment(true));
try {
  await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
  console.log('Database migrations applied.');
} finally { await pool.end(); }
