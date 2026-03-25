-- Add property details columns extracted from Hospitable's details field
ALTER TABLE "walt"."properties" ADD COLUMN IF NOT EXISTS "wifi_name" text;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN IF NOT EXISTS "wifi_password" text;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN IF NOT EXISTS "house_manual" text;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN IF NOT EXISTS "guest_access" text;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN IF NOT EXISTS "space_overview" text;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN IF NOT EXISTS "neighborhood_description" text;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN IF NOT EXISTS "getting_around" text;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN IF NOT EXISTS "additional_rules" text;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN IF NOT EXISTS "other_details" text;
