DO $$ BEGIN CREATE TYPE "walt"."checklist_category" AS ENUM('turnover', 'house_manager', 'maintenance', 'seasonal'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "walt"."checklist_scope" AS ENUM('global', 'property'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "walt"."host_again" AS ENUM('yes', 'no', 'undecided'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "walt"."ops_thread_type" AS ENUM('direct', 'group'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
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
CREATE TABLE IF NOT EXISTS "walt"."checklist_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"checklist_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."checklists" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"category" "walt"."checklist_category" DEFAULT 'turnover' NOT NULL,
	"scope" "walt"."checklist_scope" DEFAULT 'property' NOT NULL,
	"property_id" text,
	"assigned_role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."guests" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"platform_guest_id" text,
	"first_name" text,
	"last_name" text,
	"email" text,
	"phone" text,
	"host_again" "walt"."host_again" DEFAULT 'undecided' NOT NULL,
	"rating" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."inventory_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"min_quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."inventory_rooms" (
	"id" uuid PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."knowledge_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"scope" text NOT NULL,
	"property_id" text,
	"entry_type" text NOT NULL,
	"topic_key" text NOT NULL,
	"title" text,
	"question" text,
	"answer" text,
	"body" text,
	"channels" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"slug" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "knowledge_entries_scope_property_id_check" CHECK ((scope = 'global' AND property_id IS NULL) OR (scope = 'property' AND property_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."ops_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"thread_id" uuid NOT NULL,
	"sender_name" text,
	"sender_phone" text,
	"direction" "walt"."message_direction" NOT NULL,
	"body" text NOT NULL,
	"twilio_message_sid" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."ops_thread_participants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"thread_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"phone_e164" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."ops_threads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text,
	"type" "walt"."ops_thread_type" DEFAULT 'direct' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."pool_temperature_readings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"device_serial" text NOT NULL,
	"temperature_f" integer,
	"polled_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."property_appliances" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"property_id" text NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"model_number" text,
	"serial_number" text,
	"location" text,
	"purchase_date" timestamp with time zone,
	"warranty_expiration" timestamp with time zone,
	"photo_url" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."property_guidebook_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"media_url" text,
	"ai_use_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."property_memory" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"property_id" text NOT NULL,
	"fact" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"source_reservation_id" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."simulator_question_sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"property_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."simulator_questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"question_set_id" uuid NOT NULL,
	"question" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."simulator_results" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"question" text NOT NULL,
	"response" text NOT NULL,
	"grade" text NOT NULL,
	"grade_reason" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "walt"."simulator_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"property_id" text NOT NULL,
	"question_set_id" uuid NOT NULL,
	"summary" jsonb NOT NULL,
	"agent_config_snapshot" jsonb,
	"knowledge_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
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
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "walt"."seo_pipeline_runs" ALTER COLUMN "metadata" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "walt"."messages" ADD COLUMN IF NOT EXISTS "suggestion_scanned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "walt"."messages" ADD COLUMN IF NOT EXISTS "draft_status" text;--> statement-breakpoint
ALTER TABLE "walt"."messages" ADD COLUMN IF NOT EXISTS "intent" text;--> statement-breakpoint
ALTER TABLE "walt"."messages" ADD COLUMN IF NOT EXISTS "escalation_level" text;--> statement-breakpoint
ALTER TABLE "walt"."messages" ADD COLUMN IF NOT EXISTS "escalation_reason" text;--> statement-breakpoint
ALTER TABLE "walt"."messages" ADD COLUMN IF NOT EXISTS "sources_used" jsonb;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN IF NOT EXISTS "has_pool" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN IF NOT EXISTS "iaqualink_device_serial" text;--> statement-breakpoint
ALTER TABLE "walt"."property_faqs" ADD COLUMN IF NOT EXISTS "review_status" text DEFAULT 'unreviewed' NOT NULL;--> statement-breakpoint
ALTER TABLE "walt"."reservations" ADD COLUMN IF NOT EXISTS "total_price" integer;--> statement-breakpoint
ALTER TABLE "walt"."reservations" ADD COLUMN IF NOT EXISTS "nightly_rate" integer;--> statement-breakpoint
ALTER TABLE "walt"."reservations" ADD COLUMN IF NOT EXISTS "currency" text;--> statement-breakpoint
ALTER TABLE "walt"."reservations" ADD COLUMN IF NOT EXISTS "guest_score" integer;--> statement-breakpoint
ALTER TABLE "walt"."reservations" ADD COLUMN IF NOT EXISTS "guest_score_summary" text;--> statement-breakpoint
ALTER TABLE "walt"."reservations" ADD COLUMN IF NOT EXISTS "guest_scored_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "walt"."draft_events" ADD CONSTRAINT "draft_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "walt"."organizations"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "walt"."draft_events" ADD CONSTRAINT "draft_events_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "walt"."messages"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_configs_organization_id_scope_idx" ON "walt"."agent_configs" USING btree ("organization_id","scope");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checklist_items_checklist_id_idx" ON "walt"."checklist_items" USING btree ("checklist_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "draft_events_message_created_idx" ON "walt"."draft_events" USING btree ("message_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "draft_events_org_created_idx" ON "walt"."draft_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guests_org_platform_guest_idx" ON "walt"."guests" USING btree ("organization_id","platform_guest_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_items_room_id_idx" ON "walt"."inventory_items" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_rooms_property_id_idx" ON "walt"."inventory_rooms" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_entries_organization_id_idx" ON "walt"."knowledge_entries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_entries_property_id_idx" ON "walt"."knowledge_entries" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_entries_organization_id_scope_topic_key_idx" ON "walt"."knowledge_entries" USING btree ("organization_id","scope","topic_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_entries_global_unique_idx" ON "walt"."knowledge_entries" USING btree ("organization_id","topic_key") WHERE "walt"."knowledge_entries"."scope" = 'global';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_entries_property_unique_idx" ON "walt"."knowledge_entries" USING btree ("organization_id","property_id","topic_key") WHERE "walt"."knowledge_entries"."scope" = 'property';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ops_messages_thread_id_idx" ON "walt"."ops_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ops_thread_participants_thread_id_idx" ON "walt"."ops_thread_participants" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pool_temperature_readings_property_polled_at_idx" ON "walt"."pool_temperature_readings" USING btree ("property_id","polled_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "property_appliances_property_id_active_idx" ON "walt"."property_appliances" USING btree ("property_id","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "property_guidebook_entries_property_id_idx" ON "walt"."property_guidebook_entries" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "property_memory_organization_id_property_id_idx" ON "walt"."property_memory" USING btree ("organization_id","property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "simulator_question_sets_org_property_idx" ON "walt"."simulator_question_sets" USING btree ("organization_id","property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "simulator_questions_set_id_idx" ON "walt"."simulator_questions" USING btree ("question_set_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "simulator_results_run_id_idx" ON "walt"."simulator_results" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "simulator_runs_property_created_idx" ON "walt"."simulator_runs" USING btree ("property_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_reminders_pending_idx" ON "walt"."task_reminders" USING btree ("scheduled_for") WHERE "walt"."task_reminders"."sent_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_suggestions_org_status_idx" ON "walt"."task_suggestions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "task_suggestions_org_reservation_title_idx" ON "walt"."task_suggestions" USING btree ("organization_id","reservation_id","title");