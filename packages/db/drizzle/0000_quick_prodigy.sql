CREATE SCHEMA "walt";
--> statement-breakpoint
CREATE TABLE "walt"."events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"account_id" uuid NOT NULL,
	"property_id" uuid,
	"aggregate_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "walt"."organization_memberships" (
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "organization_memberships_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "walt"."organizations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "walt"."property_access" (
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"property_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "property_access_organization_id_user_id_property_id_pk" PRIMARY KEY("organization_id","user_id","property_id")
);
--> statement-breakpoint
ALTER TABLE "walt"."organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "walt"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walt"."property_access" ADD CONSTRAINT "property_access_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "walt"."organizations"("id") ON DELETE no action ON UPDATE no action;