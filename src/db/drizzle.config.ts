import { defineConfig } from 'drizzle-kit';
import { databaseOptions } from './config';

const options = databaseOptions(true);

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  dbCredentials: { ...options, host: options.host || 'localhost', database: options.database || '' },
});
