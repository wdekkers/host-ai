-- Backfill: create tables that were missed by the partially-applied 0021_perfect_psylocke migration.
-- All statements use IF NOT EXISTS so this is safe on any database state.

CREATE TABLE IF NOT EXISTS "walt"."draft_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"message_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_id" text,
	"before_payload" text,
	"after_payload" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "walt"."draft_events" ADD CONSTRAINT "draft_events_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "walt"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "walt"."draft_events" ADD CONSTRAINT "draft_events_message_id_messages_id_fk"
    FOREIGN KEY ("message_id") REFERENCES "walt"."messages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "draft_events_message_created_idx" ON "walt"."draft_events" USING btree ("message_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "draft_events_org_created_idx" ON "walt"."draft_events" USING btree ("organization_id","created_at");