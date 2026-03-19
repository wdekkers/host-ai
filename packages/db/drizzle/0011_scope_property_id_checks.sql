ALTER TABLE "walt"."agent_configs"
	DROP CONSTRAINT IF EXISTS "agent_configs_scope_property_id_check";
--> statement-breakpoint
ALTER TABLE "walt"."agent_configs"
	ADD CONSTRAINT "agent_configs_scope_property_id_check"
	CHECK (
		("scope" = 'global' AND "property_id" IS NULL)
		OR ("scope" = 'property' AND "property_id" IS NOT NULL)
	);
--> statement-breakpoint
ALTER TABLE "walt"."knowledge_entries"
	DROP CONSTRAINT IF EXISTS "knowledge_entries_scope_property_id_check";
--> statement-breakpoint
ALTER TABLE "walt"."knowledge_entries"
	ADD CONSTRAINT "knowledge_entries_scope_property_id_check"
	CHECK (
		("scope" = 'global' AND "property_id" IS NULL)
		OR ("scope" = 'property' AND "property_id" IS NOT NULL)
	);
