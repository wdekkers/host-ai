CREATE TABLE IF NOT EXISTS "walt"."inventory_rooms" (
  "id" uuid PRIMARY KEY NOT NULL,
  "property_id" text NOT NULL,
  "name" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "inventory_rooms_property_id_idx"
  ON "walt"."inventory_rooms" ("property_id");

CREATE TABLE IF NOT EXISTS "walt"."inventory_items" (
  "id" uuid PRIMARY KEY NOT NULL,
  "room_id" uuid NOT NULL,
  "name" text NOT NULL,
  "quantity" integer NOT NULL DEFAULT 0,
  "min_quantity" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "inventory_items_room_id_idx"
  ON "walt"."inventory_items" ("room_id");
