CREATE TYPE "walt"."site_template_type" AS ENUM('property', 'portfolio');--> statement-breakpoint
CREATE TABLE "walt"."sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"slug" text NOT NULL,
	"domain" text,
	"template_type" "walt"."site_template_type" DEFAULT 'property' NOT NULL,
	"name" text NOT NULL,
	"tagline" text,
	"description" text,
	"logo_url" text,
	"favicon_url" text,
	"og_image_url" text,
	"primary_color" text DEFAULT '#0284c7' NOT NULL,
	"secondary_color" text,
	"accent_color" text,
	"font_heading" text DEFAULT 'Playfair Display' NOT NULL,
	"font_body" text DEFAULT 'Inter' NOT NULL,
	"border_radius" text DEFAULT 'md' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "walt"."site_properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"property_id" text NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "walt"."site_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text,
	"content" jsonb,
	"seo_title" text,
	"seo_description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "walt"."site_pages" ADD CONSTRAINT "site_pages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "walt"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walt"."site_properties" ADD CONSTRAINT "site_properties_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "walt"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sites_slug_idx" ON "walt"."sites" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "sites_domain_idx" ON "walt"."sites" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "site_properties_site_id_idx" ON "walt"."site_properties" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "site_pages_site_id_idx" ON "walt"."site_pages" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "site_pages_site_slug_idx" ON "walt"."site_pages" USING btree ("site_id","slug");
