CREATE TABLE "walt"."seo_pipeline_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"market_key" text NOT NULL,
	"site_key" text NOT NULL,
	"trigger" text DEFAULT 'manual' NOT NULL,
	"status" text NOT NULL,
	"created_by" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"error_summary" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE INDEX "seo_pipeline_runs_organization_id_idx" ON "walt"."seo_pipeline_runs" USING btree ("organization_id");
CREATE INDEX "seo_pipeline_runs_market_key_site_key_idx" ON "walt"."seo_pipeline_runs" USING btree ("market_key","site_key");

CREATE TABLE "walt"."seo_event_candidates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"market_key" text NOT NULL,
	"source_id" text NOT NULL,
	"source_url" text NOT NULL,
	"source_domain" text NOT NULL,
	"title" text NOT NULL,
	"venue_name" text,
	"city" text,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"summary" text,
	"source_snippet" text,
	"normalized_hash" text NOT NULL,
	"status" text DEFAULT 'discovered' NOT NULL,
	"raw" jsonb NOT NULL,
	"discovered_at" timestamp with time zone NOT NULL,
	CONSTRAINT "seo_event_candidates_run_id_seo_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "walt"."seo_pipeline_runs"("id") ON DELETE no action ON UPDATE no action
);

CREATE UNIQUE INDEX "seo_event_candidates_org_market_hash_idx" ON "walt"."seo_event_candidates" USING btree ("organization_id","market_key","normalized_hash");

CREATE TABLE "walt"."seo_opportunities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"candidate_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"market_key" text NOT NULL,
	"site_key" text NOT NULL,
	"target_keyword" text NOT NULL,
	"target_slug" text NOT NULL,
	"traveler_intent" text NOT NULL,
	"property_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"score" integer NOT NULL,
	"reasons" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"evaluated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "seo_opportunities_candidate_id_seo_event_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "walt"."seo_event_candidates"("id") ON DELETE no action ON UPDATE no action
);

CREATE UNIQUE INDEX "seo_opportunities_candidate_id_idx" ON "walt"."seo_opportunities" USING btree ("candidate_id");
CREATE INDEX "seo_opportunities_organization_id_score_idx" ON "walt"."seo_opportunities" USING btree ("organization_id","score");

CREATE TABLE "walt"."seo_drafts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"market_key" text NOT NULL,
	"site_key" text NOT NULL,
	"status" text DEFAULT 'generated' NOT NULL,
	"title_tag" text NOT NULL,
	"meta_description" text NOT NULL,
	"slug" text NOT NULL,
	"h1" text NOT NULL,
	"outline" jsonb NOT NULL,
	"body_markdown" text NOT NULL,
	"faq_items" jsonb NOT NULL,
	"cta_text" text NOT NULL,
	"internal_links" jsonb NOT NULL,
	"source_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"review_notes" text[] DEFAULT '{}'::text[] NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "seo_drafts_opportunity_id_seo_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "walt"."seo_opportunities"("id") ON DELETE no action ON UPDATE no action
);

CREATE UNIQUE INDEX "seo_drafts_opportunity_id_idx" ON "walt"."seo_drafts" USING btree ("opportunity_id");
CREATE INDEX "seo_drafts_organization_id_status_updated_at_idx" ON "walt"."seo_drafts" USING btree ("organization_id","status","updated_at");
CREATE UNIQUE INDEX "seo_drafts_site_key_slug_idx" ON "walt"."seo_drafts" USING btree ("site_key","slug");
