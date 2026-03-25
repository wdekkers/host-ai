/**
 * Custom migration runner that replaces drizzle-kit migrate.
 *
 * drizzle-kit has a bug where it records migration hashes without
 * executing the SQL, or skips migrations due to row-count mismatches
 * in the tracking table. This script reads the journal, computes
 * hashes, and applies any migration whose hash is not yet tracked.
 *
 * Safe to run repeatedly — only applies missing migrations.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const drizzleDir = resolve(__dirname, '../drizzle');

// --- Database connection ---

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

// --- Helpers ---

function hashSql(sql) {
  return createHash('sha256').update(sql).digest('hex');
}

// --- Main ---

try {
  // Ensure the tracking table and schema exist
  await pool.query('CREATE SCHEMA IF NOT EXISTS drizzle');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `);

  // Clean legacy entries (same as clean-legacy-migrations.mjs)
  const { rowCount: legacyCleaned } = await pool.query(
    'DELETE FROM drizzle.__drizzle_migrations WHERE created_at < 1772000000000',
  );
  if (legacyCleaned > 0) {
    console.log(`Cleaned ${legacyCleaned} legacy migration entries`);
  }

  // Read the journal
  const journal = JSON.parse(readFileSync(resolve(drizzleDir, 'meta/_journal.json'), 'utf8'));
  const entries = journal.entries;

  // Get already-applied hashes
  const { rows: applied } = await pool.query('SELECT hash FROM drizzle.__drizzle_migrations');
  const appliedHashes = new Set(applied.map(r => r.hash));

  let appliedCount = 0;
  let skippedCount = 0;

  for (const entry of entries) {
    const sqlFile = resolve(drizzleDir, `${entry.tag}.sql`);
    let sql;
    try {
      sql = readFileSync(sqlFile, 'utf8');
    } catch {
      console.warn(`  WARN: SQL file missing for ${entry.tag}, skipping`);
      continue;
    }

    const hash = hashSql(sql);

    if (appliedHashes.has(hash)) {
      skippedCount++;
      continue;
    }

    console.log(`  Applying ${entry.tag}...`);

    // Split on drizzle's statement breakpoint marker
    const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);

    for (const stmt of statements) {
      try {
        await pool.query(stmt);
      } catch (err) {
        // Tolerate common "already done" or constraint errors:
        // 42P07 = relation already exists
        // 42710 = object already exists (constraint, index, etc.)
        // 42701 = column already exists
        // 23503 = FK violation (existing data doesn't match — skip ADD CONSTRAINT)
        // 23505 = unique violation
        const toleratedCodes = ['42P07', '42710', '42701', '23503', '23505'];
        if (toleratedCodes.includes(err.code)) {
          console.log(`    Skipped (${err.code}): ${err.message.slice(0, 100)}`);
          continue;
        }
        console.error(`  ERROR in ${entry.tag}: ${err.message}`);
        console.error(`  Statement: ${stmt.slice(0, 200)}`);
        throw err;
      }
    }

    // Record the migration
    await pool.query(
      'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
      [hash, entry.when],
    );

    appliedHashes.add(hash);
    appliedCount++;
    console.log(`  Applied ${entry.tag} (${statements.length} statements)`);
  }

  if (appliedCount > 0) {
    console.log(`\nMigrations complete: ${appliedCount} applied, ${skippedCount} skipped`);
  } else {
    console.log(`All ${skippedCount} migrations already applied`);
  }
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
