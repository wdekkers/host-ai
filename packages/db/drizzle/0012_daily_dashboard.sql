ALTER TABLE "walt"."properties" ADD COLUMN IF NOT EXISTS "has_pool" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "walt"."messages" ADD COLUMN IF NOT EXISTS "suggestion_scanned_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."task_suggestions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "property_id" text NOT NULL,
  "property_name" text NOT NULL,
  "reservation_id" text NOT NULL,
  "message_id" uuid,
  "title" text NOT NULL,
  "description" text,
  "suggested_due_date" timestamp with time zone,
  "source" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_suggestions_org_status_idx"
  ON "walt"."task_suggestions" ("organization_id", "status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "task_suggestions_org_reservation_title_idx"
  ON "walt"."task_suggestions" ("organization_id", "reservation_id", "title");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."task_reminders" (
  "id" uuid PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL,
  "organization_id" text NOT NULL,
  "task_title" text NOT NULL,
  "property_name" text NOT NULL,
  "channels" text[] NOT NULL,
  "scheduled_for" timestamp with time zone NOT NULL,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_reminders_pending_idx"
  ON "walt"."task_reminders" ("scheduled_for")
  WHERE "sent_at" IS NULL;
