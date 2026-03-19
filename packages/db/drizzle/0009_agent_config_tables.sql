CREATE TABLE IF NOT EXISTS "walt"."agent_configs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"scope" text NOT NULL,
	"property_id" text,
	"tone" text,
	"emoji_use" text,
	"response_length" text,
	"escalation_rules" text,
	"special_instructions" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."property_guidebook_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"property_id" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"media_url" text,
	"ai_use_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."property_memory" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"property_id" text NOT NULL,
	"fact" text NOT NULL,
	"source" text NOT NULL,
	"source_reservation_id" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_configs_organization_id_idx" ON "walt"."agent_configs" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "property_guidebook_entries_organization_id_idx" ON "walt"."property_guidebook_entries" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "property_guidebook_entries_property_id_idx" ON "walt"."property_guidebook_entries" USING btree ("property_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "property_memory_organization_id_idx" ON "walt"."property_memory" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "property_memory_property_id_idx" ON "walt"."property_memory" USING btree ("property_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_configs_global_unique_idx" ON "walt"."agent_configs" ("organization_id") WHERE "scope" = 'global';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_configs_property_unique_idx" ON "walt"."agent_configs" ("organization_id", "property_id") WHERE "scope" = 'property';
