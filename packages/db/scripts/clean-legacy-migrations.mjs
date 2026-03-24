/**
 * Removes legacy migration entries from the Drizzle tracking table.
 *
 * Background: An older Drizzle setup left 7 rows in drizzle.__drizzle_migrations
 * with timestamps before the current journal (created_at < 1772000000000).
 * Drizzle counts total rows to decide which migrations to skip, so these
 * ghost entries cause it to skip real pending migrations.
 *
 * This script is safe to run repeatedly — it only deletes rows with
 * timestamps that predate the current journal's first entry.
 */

import pg from 'pg';

// Strip sslmode from connection string so the explicit ssl option takes effect.
// Matches the pattern in packages/db/src/client.ts.
let connStr = process.env.DATABASE_URL ?? '';
let isLocalhost = false;
if (connStr) {
  const url = new URL(connStr);
  url.searchParams.delete('sslmode');
  connStr = url.toString();
  isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

const pool = new pg.Pool({
  connectionString: connStr,
  ssl: isLocalhost ? false : { rejectUnauthorized: false },
});

try {
  const { rowCount } = await pool.query(
    'DELETE FROM drizzle.__drizzle_migrations WHERE created_at < 1772000000000',
  );
  if (rowCount > 0) {
    console.log(`Cleaned ${rowCount} legacy migration entries`);
  } else {
    console.log('No legacy migration entries to clean');
  }

  // Ensure migration 0027 (journey engine tables) is actually applied.
  // Drizzle has repeatedly recorded this migration's hash without executing
  // the SQL. We bypass drizzle and run the DDL directly if the tables are missing.
  const { rows: journeyCheck } = await pool.query(
    "SELECT 1 FROM pg_tables WHERE schemaname = 'walt' AND tablename = 'journeys' LIMIT 1",
  );
  if (journeyCheck.length === 0) {
    console.log('Journey tables missing — applying migration 0027 directly...');

    // Remove any phantom tracking entries for this migration
    const phantomHash = '0e42a1a218838424f51d21a4bdee2d5bbb801658d8c9adbd78b9158b99d97fdb';
    await pool.query('DELETE FROM drizzle.__drizzle_migrations WHERE hash = $1', [phantomHash]);

    // Read and execute the migration SQL
    const { readFileSync } = await import('fs');
    const { resolve, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const sqlFile = resolve(__dirname, '../drizzle/0027_wise_clint_barton.sql');
    const sql = readFileSync(sqlFile, 'utf8');

    // Split on drizzle's statement breakpoint marker and execute each statement
    const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await pool.query(stmt);
    }
    console.log(`Applied ${statements.length} statements from migration 0027`);
  }
} catch (err) {
  // Table may not exist on fresh databases — that's fine
  if (err.code === '42P01') {
    console.log('Migration table does not exist yet — skipping cleanup');
  } else {
    throw err;
  }
} finally {
  await pool.end();
}
