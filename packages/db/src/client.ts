import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export const createDb = (connectionString: string) => {
  // Strip sslmode from the connection string so the explicit ssl option below
  // takes full effect. AWS Lightsail Postgres uses a self-signed CA that is
  // not in the system trust store, so we accept the connection but skip CA
  // chain verification (the connection is still TLS-encrypted).
  // Guard against undefined at build time (DATABASE_URL not available then).
  let connStr = connectionString;
  if (connectionString) {
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode');
    connStr = url.toString();
  }
  const pool = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  return drizzle({ client: pool });
};
