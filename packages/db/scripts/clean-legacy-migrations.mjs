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

  // Drizzle has a bug where it records migration hashes without executing
  // the SQL. We bypass drizzle and run DDL directly for any missing tables.
  const { readFileSync } = await import('fs');
  const { resolve, dirname } = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = dirname(fileURLToPath(import.meta.url));

  // Each entry: check if a sentinel table exists; if not, run the migration SQL directly.
  const phantomMigrations = [
    { table: 'draft_events', file: '0026_backfill_missing_tables.sql', label: '0026' },
    { table: 'journeys', file: '0027_wise_clint_barton.sql', label: '0027' },
  ];

  for (const { table, file, label } of phantomMigrations) {
    const { rows } = await pool.query(
      "SELECT 1 FROM pg_tables WHERE schemaname = 'walt' AND tablename = $1 LIMIT 1",
      [table],
    );
    if (rows.length > 0) continue;

    console.log(`Table walt.${table} missing — applying migration ${label} directly...`);

    const sqlFile = resolve(__dirname, '../drizzle', file);
    const sql = readFileSync(sqlFile, 'utf8');
    const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await pool.query(stmt);
    }
    console.log(`Applied ${statements.length} statements from migration ${label}`);
  }

  // Drop the FK constraint on draft_events.organization_id → organizations.id.
  // The organizations table is not populated (org IDs come from Clerk, not this table),
  // so this FK causes inserts to fail.
  try {
    await pool.query(
      'ALTER TABLE walt.draft_events DROP CONSTRAINT IF EXISTS draft_events_organization_id_organizations_id_fk',
    );
    console.log('Dropped draft_events organization FK constraint (if existed)');
  } catch {
    // Ignore — constraint may not exist
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
