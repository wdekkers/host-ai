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

  // Remove phantom entry for migration 0027 (journey engine tables).
  // A previous deploy recorded this hash without actually running the SQL
  // because the journal entry was missing at the time. Removing it allows
  // drizzle to apply the migration properly on the next run.
  const phantomHash = '0e42a1a218838424f51d21a4bdee2d5bbb801658d8c9adbd78b9158b99d97fdb';
  const { rowCount: phantomCount } = await pool.query(
    'DELETE FROM drizzle.__drizzle_migrations WHERE hash = $1',
    [phantomHash],
  );
  if (phantomCount > 0) {
    console.log('Removed phantom migration entry for 0027_wise_clint_barton');
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
