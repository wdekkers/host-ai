CREATE TABLE "walt"."reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"reservation_id" text,
	"property_id" text,
	"platform" text,
	"rating" integer,
	"public_review" text,
	"public_response" text,
	"private_feedback" text,
	"guest_first_name" text,
	"guest_last_name" text,
	"reviewed_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"can_respond" boolean,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone NOT NULL
);
