ALTER TABLE "walt"."organization_memberships" ALTER COLUMN "organization_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "walt"."organizations" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "walt"."property_access" ALTER COLUMN "organization_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "walt"."task_audit_events" ALTER COLUMN "organization_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "walt"."task_categories" ALTER COLUMN "organization_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "walt"."tasks" ALTER COLUMN "organization_id" SET DATA TYPE text;