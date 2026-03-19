CREATE TABLE "walt"."knowledge_entries" (
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
	"channels" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"slug" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "knowledge_entries_organization_id_idx" ON "walt"."knowledge_entries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "knowledge_entries_property_id_idx" ON "walt"."knowledge_entries" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "knowledge_entries_organization_id_scope_topic_key_idx" ON "walt"."knowledge_entries" USING btree ("organization_id","scope","topic_key");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_entries_global_unique_idx" ON "walt"."knowledge_entries" ("organization_id","topic_key") WHERE "scope" = 'global';--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_entries_property_unique_idx" ON "walt"."knowledge_entries" ("organization_id","property_id","topic_key") WHERE "scope" = 'property';
