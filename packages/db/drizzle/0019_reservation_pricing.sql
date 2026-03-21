ALTER TABLE "walt"."reservations"
  ADD COLUMN IF NOT EXISTS "total_price" integer,
  ADD COLUMN IF NOT EXISTS "nightly_rate" integer,
  ADD COLUMN IF NOT EXISTS "currency" text;
