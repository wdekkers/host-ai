CREATE TABLE "walt"."task_audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"action" text NOT NULL,
	"changed_by" text NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	"delta" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "walt"."task_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "walt"."tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"category_id" uuid,
	"assignee_id" text,
	"property_ids" text[] DEFAULT '{}' NOT NULL,
	"due_date" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "walt"."task_audit_events" ADD CONSTRAINT "task_audit_events_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "walt"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_audit_events_task_id_idx" ON "walt"."task_audit_events" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_categories_organization_id_idx" ON "walt"."task_categories" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tasks_organization_id_idx" ON "walt"."tasks" USING btree ("organization_id");