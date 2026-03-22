ALTER TABLE "walt"."reservations" ADD COLUMN "guest_score" integer;--> statement-breakpoint
ALTER TABLE "walt"."reservations" ADD COLUMN "guest_score_summary" text;--> statement-breakpoint
ALTER TABLE "walt"."reservations" ADD COLUMN "guest_scored_at" timestamp with time zone;