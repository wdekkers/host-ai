-- Replace the partial unique index on (reservation_id, source_message_id) with a
-- non-partial one. Drizzle's onConflictDoNothing({ target: [...] }) generates
-- ON CONFLICT (reservation_id, source_message_id) WITHOUT the partial WHERE
-- predicate, which Postgres rejects ("there is no unique or exclusion constraint
-- matching the ON CONFLICT specification").
--
-- A non-partial unique index works because Postgres treats NULL values as
-- distinct in unique indexes by default (SQL standard behavior, and the default
-- through PG 16). Multiple rows with source_message_id IS NULL coexist (natural
-- assessment triggers), while a specific (reservation_id, source_message_id)
-- pair still rejects duplicates (webhook idempotency).

DROP INDEX IF EXISTS walt.guest_assessments_reservation_msg_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS guest_assessments_reservation_msg_uniq
  ON walt.guest_assessments (reservation_id, source_message_id);
