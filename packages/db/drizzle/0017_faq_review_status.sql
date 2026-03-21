ALTER TABLE "walt"."property_faqs"
  ADD COLUMN IF NOT EXISTS "review_status" text NOT NULL DEFAULT 'unreviewed';
