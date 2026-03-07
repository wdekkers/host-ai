CREATE TABLE "walt"."property_faqs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"category" text NOT NULL,
	"question" text NOT NULL,
	"answer" text,
	"examples" jsonb,
	"analysed_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "property_faqs_property_category_idx" ON "walt"."property_faqs" USING btree ("property_id","category");