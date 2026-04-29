ALTER TABLE "walt"."properties"
  ADD COLUMN IF NOT EXISTS "nicknames" text[] NOT NULL DEFAULT '{}'::text[];
