ALTER TABLE "walt"."organization_memberships" DROP CONSTRAINT "organization_memberships_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "walt"."property_access" DROP CONSTRAINT "property_access_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "walt"."organizations" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "walt"."organization_memberships" ALTER COLUMN "organization_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "walt"."property_access" ALTER COLUMN "organization_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "walt"."task_audit_events" ALTER COLUMN "organization_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "walt"."task_categories" ALTER COLUMN "organization_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "walt"."tasks" ALTER COLUMN "organization_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "walt"."organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "walt"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walt"."property_access" ADD CONSTRAINT "property_access_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "walt"."organizations"("id") ON DELETE no action ON UPDATE no action;
