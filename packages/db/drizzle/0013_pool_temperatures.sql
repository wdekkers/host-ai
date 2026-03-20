ALTER TABLE "walt"."properties" ADD COLUMN IF NOT EXISTS "iaqualink_device_serial" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."pool_temperature_readings" (
  "id" uuid PRIMARY KEY NOT NULL,
  "property_id" text NOT NULL,
  "device_serial" text NOT NULL,
  "temperature_f" integer,
  "polled_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pool_temperature_readings_property_polled_at_idx"
  ON "walt"."pool_temperature_readings" ("property_id", "polled_at" DESC);
