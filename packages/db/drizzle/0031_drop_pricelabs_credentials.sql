-- Drop the pricelabs_credentials table. The PriceLabs integration now uses a single
-- PRICELABS_API_KEY env var (same pattern as Hospitable, OpenAI, etc.) rather than
-- per-org encrypted storage. See refactor commit: env var replaces the DB credential.
DROP TABLE IF EXISTS "walt"."pricelabs_credentials";
