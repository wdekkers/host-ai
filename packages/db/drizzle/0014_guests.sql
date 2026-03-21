DO $$ BEGIN
  CREATE TYPE "walt"."host_again" AS ENUM('yes', 'no', 'undecided');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "walt"."guests" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "platform_guest_id" text,
  "first_name" text,
  "last_name" text,
  "email" text,
  "phone" text,
  "host_again" "walt"."host_again" NOT NULL DEFAULT 'undecided',
  "rating" integer,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "guests_org_platform_guest_idx"
  ON "walt"."guests" ("organization_id", "platform_guest_id");
