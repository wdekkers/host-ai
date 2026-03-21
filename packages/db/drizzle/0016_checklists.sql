DO $$ BEGIN
  CREATE TYPE "walt"."checklist_category" AS ENUM('turnover', 'house_manager', 'maintenance', 'seasonal');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "walt"."checklist_scope" AS ENUM('global', 'property');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "walt"."checklists" (
  "id" uuid PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "name" text NOT NULL,
  "category" "walt"."checklist_category" NOT NULL DEFAULT 'turnover',
  "scope" "walt"."checklist_scope" NOT NULL DEFAULT 'property',
  "property_id" text,
  "assigned_role" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "walt"."checklist_items" (
  "id" uuid PRIMARY KEY NOT NULL,
  "checklist_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "sort_order" integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "checklist_items_checklist_id_idx"
  ON "walt"."checklist_items" ("checklist_id");
