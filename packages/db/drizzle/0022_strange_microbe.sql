ALTER TABLE "walt"."properties" ADD COLUMN "check_in_time" text;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "check_out_time" text;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "timezone" text;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "max_guests" integer;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "bedrooms" integer;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "beds" integer;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "bathrooms" text;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "pets_allowed" boolean;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "smoking_allowed" boolean;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "events_allowed" boolean;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "amenities" text[];--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "property_type" text;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "room_type" text;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "picture_url" text;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "address_state" text;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "postcode" text;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "address_number" text;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "listings" jsonb;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "room_details" jsonb;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "tags" text[];--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "public_name" text;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "calendar_restricted" boolean;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "parent_child" jsonb;--> statement-breakpoint
ALTER TABLE "walt"."properties" ADD COLUMN "ical_imports" jsonb;