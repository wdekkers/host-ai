DO $$ BEGIN
  CREATE TYPE "walt"."ops_thread_type" AS ENUM('direct', 'group');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "walt"."ops_threads" (
  "id" uuid PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "name" text,
  "type" "walt"."ops_thread_type" NOT NULL DEFAULT 'direct',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "walt"."ops_thread_participants" (
  "id" uuid PRIMARY KEY NOT NULL,
  "thread_id" uuid NOT NULL,
  "display_name" text NOT NULL,
  "phone_e164" text NOT NULL,
  "joined_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ops_thread_participants_thread_id_idx"
  ON "walt"."ops_thread_participants" ("thread_id");

CREATE TABLE IF NOT EXISTS "walt"."ops_messages" (
  "id" uuid PRIMARY KEY NOT NULL,
  "thread_id" uuid NOT NULL,
  "sender_name" text,
  "sender_phone" text,
  "direction" "walt"."message_direction" NOT NULL,
  "body" text NOT NULL,
  "twilio_message_sid" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ops_messages_thread_id_idx"
  ON "walt"."ops_messages" ("thread_id");
