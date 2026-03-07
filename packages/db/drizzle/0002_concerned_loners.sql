CREATE TABLE "walt"."properties" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"status" text,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone NOT NULL
);
