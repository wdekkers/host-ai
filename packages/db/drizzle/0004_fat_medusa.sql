CREATE TYPE "walt"."actor_type" AS ENUM('system', 'admin', 'vendor');--> statement-breakpoint
CREATE TYPE "walt"."consent_method" AS ENUM('web_form', 'inbound_sms', 'admin_import');--> statement-breakpoint
CREATE TYPE "walt"."consent_status" AS ENUM('opted_in', 'opted_out', 'pending');--> statement-breakpoint
CREATE TYPE "walt"."message_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "walt"."message_type" AS ENUM('operational', 'consent_confirmation', 'help', 'stop_confirmation');--> statement-breakpoint
CREATE TYPE "walt"."vendor_status" AS ENUM('invited', 'active', 'opted_out', 'blocked');--> statement-breakpoint
CREATE TABLE "walt"."audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vendor_id" uuid,
	"actor_type" "walt"."actor_type" NOT NULL,
	"actor_id" text,
	"event_type" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "walt"."sms_consents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vendor_id" uuid NOT NULL,
	"consent_status" "walt"."consent_status" NOT NULL,
	"consent_method" "walt"."consent_method" NOT NULL,
	"consent_text_version" text NOT NULL,
	"consent_text_snapshot" text NOT NULL,
	"source_url" text NOT NULL,
	"source_domain" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"checkbox_checked" boolean NOT NULL,
	"confirmed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "walt"."sms_message_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vendor_id" uuid NOT NULL,
	"direction" "walt"."message_direction" NOT NULL,
	"twilio_message_sid" text,
	"from_number" text NOT NULL,
	"to_number" text NOT NULL,
	"body" text NOT NULL,
	"message_type" "walt"."message_type" NOT NULL,
	"delivery_status" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "walt"."vendors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"phone_e164" text NOT NULL,
	"email" text,
	"status" "walt"."vendor_status" DEFAULT 'invited' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "vendors_phone_e164_unique" UNIQUE("phone_e164")
);
--> statement-breakpoint
ALTER TABLE "walt"."sms_consents" ADD CONSTRAINT "sms_consents_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "walt"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walt"."sms_message_logs" ADD CONSTRAINT "sms_message_logs_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "walt"."vendors"("id") ON DELETE no action ON UPDATE no action;