-- Drop the FK constraint on draft_events.organization_id → organizations.id.
-- The organizations table is not populated (org IDs come from Clerk),
-- so this FK causes inserts to fail.
ALTER TABLE "walt"."draft_events" DROP CONSTRAINT IF EXISTS "draft_events_organization_id_organizations_id_fk";
