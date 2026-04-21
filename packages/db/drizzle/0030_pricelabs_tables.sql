-- PriceLabs integration: listing mapping, time-series snapshots, sync audit.

CREATE TABLE IF NOT EXISTS "walt"."pricelabs_listings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" text NOT NULL REFERENCES "walt"."organizations"("id"),
  "property_id" text REFERENCES "walt"."properties"("id"),
  "pricelabs_listing_id" text NOT NULL,
  "pricelabs_listing_name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'unmapped',
  "match_confidence" text,
  "last_synced_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "pricelabs_listings_org_listing_unique" UNIQUE ("org_id", "pricelabs_listing_id"),
  CONSTRAINT "pricelabs_listings_status_check" CHECK ("status" IN ('active', 'unmapped', 'inactive')),
  CONSTRAINT "pricelabs_listings_confidence_check" CHECK ("match_confidence" IS NULL OR "match_confidence" IN ('manual', 'auto-high', 'auto-low'))
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "walt"."pricelabs_sync_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" text NOT NULL REFERENCES "walt"."organizations"("id"),
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz,
  "status" text NOT NULL DEFAULT 'running',
  "listings_synced" integer NOT NULL DEFAULT 0,
  "listings_failed" integer NOT NULL DEFAULT 0,
  "error_summary" text,
  CONSTRAINT "pricelabs_sync_runs_status_check" CHECK ("status" IN ('running', 'success', 'partial', 'failed'))
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "walt"."pricing_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" text NOT NULL REFERENCES "walt"."organizations"("id"),
  "pricelabs_listing_id" text NOT NULL,
  "date" date NOT NULL,
  "recommended_price" integer NOT NULL,
  "published_price" integer,
  "base_price" integer NOT NULL,
  "min_price" integer NOT NULL,
  "max_price" integer NOT NULL,
  "min_stay" integer,
  "closed_to_arrival" boolean NOT NULL DEFAULT false,
  "closed_to_departure" boolean NOT NULL DEFAULT false,
  "is_booked" boolean NOT NULL DEFAULT false,
  "sync_run_id" uuid NOT NULL REFERENCES "walt"."pricelabs_sync_runs"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "pricing_snapshots_lookup_idx"
  ON "walt"."pricing_snapshots" ("org_id", "pricelabs_listing_id", "date" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "pricing_snapshots_run_idx"
  ON "walt"."pricing_snapshots" ("sync_run_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "walt"."pricelabs_settings_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" text NOT NULL REFERENCES "walt"."organizations"("id"),
  "pricelabs_listing_id" text NOT NULL,
  "sync_run_id" uuid NOT NULL REFERENCES "walt"."pricelabs_sync_runs"("id"),
  "settings_blob" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "pricelabs_settings_snapshots_lookup_idx"
  ON "walt"."pricelabs_settings_snapshots" ("org_id", "pricelabs_listing_id", "created_at" DESC);
