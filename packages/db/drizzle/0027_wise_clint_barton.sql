CREATE TABLE "walt"."conversation_settings" (
	"reservation_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"ai_status" text DEFAULT 'active' NOT NULL,
	"ai_paused_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "walt"."journey_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journey_id" uuid NOT NULL,
	"reservation_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"current_step_index" integer DEFAULT 0 NOT NULL,
	"journey_version" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"next_execution_at" timestamp with time zone,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "walt"."journey_exclusions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journey_id" uuid NOT NULL,
	"reservation_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"excluded_by" text NOT NULL,
	"excluded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "walt"."journey_execution_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"journey_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"reservation_id" text NOT NULL,
	"step_index" integer NOT NULL,
	"action" text NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "walt"."journeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"property_ids" text[] DEFAULT '{}' NOT NULL,
	"trigger_type" text NOT NULL,
	"trigger_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"steps" jsonb NOT NULL,
	"coverage_schedule" jsonb,
	"approval_mode" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"prompt" text NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "walt"."notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"member_id" text,
	"category" text NOT NULL,
	"channels" text[] NOT NULL,
	"quiet_hours" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "walt"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"metadata" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "walt"."upsell_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"property_id" text NOT NULL,
	"reservation_id" text NOT NULL,
	"journey_id" uuid,
	"enrollment_id" uuid,
	"upsell_type" text NOT NULL,
	"status" text DEFAULT 'offered' NOT NULL,
	"message_id" text,
	"offered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"estimated_revenue" integer,
	"actual_revenue" integer
);
--> statement-breakpoint
ALTER TABLE "walt"."journey_enrollments" ADD CONSTRAINT "journey_enrollments_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "walt"."journeys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walt"."journey_exclusions" ADD CONSTRAINT "journey_exclusions_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "walt"."journeys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walt"."journey_execution_log" ADD CONSTRAINT "journey_execution_log_enrollment_id_journey_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "walt"."journey_enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walt"."journey_execution_log" ADD CONSTRAINT "journey_execution_log_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "walt"."journeys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walt"."upsell_events" ADD CONSTRAINT "upsell_events_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "walt"."journeys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walt"."upsell_events" ADD CONSTRAINT "upsell_events_enrollment_id_journey_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "walt"."journey_enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "journey_enrollments_unique_idx" ON "walt"."journey_enrollments" USING btree ("journey_id","reservation_id");--> statement-breakpoint
CREATE INDEX "journey_enrollments_pending_idx" ON "walt"."journey_enrollments" USING btree ("next_execution_at") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "journey_enrollments_organization_id_idx" ON "walt"."journey_enrollments" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journey_exclusions_unique_idx" ON "walt"."journey_exclusions" USING btree ("journey_id","reservation_id");--> statement-breakpoint
CREATE INDEX "journey_execution_log_enrollment_idx" ON "walt"."journey_execution_log" USING btree ("enrollment_id","created_at");--> statement-breakpoint
CREATE INDEX "journey_execution_log_rate_limit_idx" ON "walt"."journey_execution_log" USING btree ("reservation_id","action","created_at");--> statement-breakpoint
CREATE INDEX "journeys_organization_id_idx" ON "walt"."journeys" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "journeys_status_idx" ON "walt"."journeys" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "notification_preferences_org_idx" ON "walt"."notification_preferences" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_unique_idx" ON "walt"."notification_preferences" USING btree ("organization_id","member_id","category");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "walt"."notifications" USING btree ("organization_id","recipient_id") WHERE read_at IS NULL;--> statement-breakpoint
CREATE INDEX "upsell_events_org_property_idx" ON "walt"."upsell_events" USING btree ("organization_id","property_id","status");