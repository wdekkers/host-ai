import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export const createDb = (connectionString: string) => {
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  return drizzle({ client: pool });
};
