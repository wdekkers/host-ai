-- Drop FK constraints on org_id for all pricelabs tables.
--
-- The walt.organizations / organization_memberships / property_access tables
-- were added for future multi-tenant SaaS but have never been populated. With
-- the FK in place, any insert into pricelabs_* tables fails because the Clerk
-- org id doesn't exist in walt.organizations.
--
-- Keeping the org_id column itself (forward-compat for multi-tenancy), just
-- dropping the enforced FK. When multi-tenancy ships, the FK can be re-added
-- alongside the org-provisioning code.

ALTER TABLE "walt"."pricelabs_listings"
  DROP CONSTRAINT IF EXISTS "pricelabs_listings_org_id_fkey";
--> statement-breakpoint
ALTER TABLE "walt"."pricelabs_sync_runs"
  DROP CONSTRAINT IF EXISTS "pricelabs_sync_runs_org_id_fkey";
--> statement-breakpoint
ALTER TABLE "walt"."pricing_snapshots"
  DROP CONSTRAINT IF EXISTS "pricing_snapshots_org_id_fkey";
--> statement-breakpoint
ALTER TABLE "walt"."pricelabs_settings_snapshots"
  DROP CONSTRAINT IF EXISTS "pricelabs_settings_snapshots_org_id_fkey";
