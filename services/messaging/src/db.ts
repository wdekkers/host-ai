import { createDb } from '@walt/db';

/** Lazily-created singleton DB client for the messaging service. */
let _db: ReturnType<typeof createDb> | null = null;

export function getDb(): ReturnType<typeof createDb> {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    _db = createDb(url);
  }
  return _db;
}
