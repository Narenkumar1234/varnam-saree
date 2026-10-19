export function databaseOptions(admin = false) {
  const adminUser = admin && process.env.SQL_ADMIN_USER;
  return {
    host: process.env.SQL_HOST,
    port: Number(process.env.SQL_PORT || '5432'),
    user: adminUser || process.env.SQL_USER,
    password: adminUser ? process.env.SQL_ADMIN_PASSWORD : process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    ssl: process.env.SQL_SSL === 'true' ? { rejectUnauthorized: false } : false as const,
  };
}

export function requireDatabaseEnvironment(admin = false) {
  const options = databaseOptions(admin);
  if (!options.host || !options.database || !options.user) {
    throw new Error('Configure SQL_HOST, SQL_DB_NAME and SQL_USER (or SQL_ADMIN_USER for migrations).');
  }
  return options;
}
