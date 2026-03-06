import { defineConfig } from 'drizzle-kit';

// pg-connection-string now treats sslmode=require as verify-full (see warning).
// Adding uselibpqcompat=true restores the original behavior: require TLS but
// skip CA chain verification, which is needed for AWS Lightsail Postgres.
const rawUrl = process.env.DATABASE_URL ?? 'postgres://walt:walt@localhost:5432/walt';
const url = rawUrl.replace('sslmode=require', 'uselibpqcompat=true&sslmode=require');

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url }
});
