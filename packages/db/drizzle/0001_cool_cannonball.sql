CREATE TABLE "walt"."messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reservation_id" text NOT NULL,
	"platform" text,
	"body" text NOT NULL,
	"sender_type" text NOT NULL,
	"sender_full_name" text,
	"created_at" timestamp with time zone NOT NULL,
	"suggestion" text,
	"suggestion_generated_at" timestamp with time zone,
	"raw" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "walt"."reservations" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text,
	"platform" text,
	"platform_id" text,
	"status" text,
	"arrival_date" timestamp with time zone,
	"departure_date" timestamp with time zone,
	"check_in" timestamp with time zone,
	"check_out" timestamp with time zone,
	"booking_date" timestamp with time zone,
	"last_message_at" timestamp with time zone,
	"nights" integer,
	"guest_id" text,
	"guest_first_name" text,
	"guest_last_name" text,
	"guest_email" text,
	"property_id" text,
	"property_name" text,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "walt"."messages" ADD CONSTRAINT "messages_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "walt"."reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "messages_reservation_created_at_idx" ON "walt"."messages" USING btree ("reservation_id","created_at");