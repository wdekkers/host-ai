import { defineConfig } from 'drizzle-kit';

// Parse the URL manually so we can pass explicit SSL options.
// drizzle-kit uses pg-connection-string internally, which now treats
// sslmode=require as verify-full — causing cert errors on AWS RDS.
const raw = process.env.DATABASE_URL ?? 'postgres://walt:walt@localhost:5432/walt';
const u = new URL(raw);

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: u.hostname,
    port: u.port ? parseInt(u.port) : 5432,
    user: u.username || undefined,
    password: u.password || undefined,
    database: u.pathname.replace(/^\//, ''),
    ssl: { rejectUnauthorized: false }
  }
});
