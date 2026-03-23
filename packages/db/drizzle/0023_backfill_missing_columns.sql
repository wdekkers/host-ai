-- Backfill migration: re-apply all columns from 0021_perfect_psylocke and 0022_strange_microbe
-- that may be missing on production due to a partial migration failure.
-- All statements use IF NOT EXISTS so this is safe to run on any database state.

-- From 0021_perfect_psylocke (messages columns)
ALTER TABLE walt.messages ADD COLUMN IF NOT EXISTS suggestion_scanned_at timestamp with time zone;--> statement-breakpoint
ALTER TABLE walt.messages ADD COLUMN IF NOT EXISTS draft_status text;--> statement-breakpoint
ALTER TABLE walt.messages ADD COLUMN IF NOT EXISTS intent text;--> statement-breakpoint
ALTER TABLE walt.messages ADD COLUMN IF NOT EXISTS escalation_level text;--> statement-breakpoint
ALTER TABLE walt.messages ADD COLUMN IF NOT EXISTS escalation_reason text;--> statement-breakpoint
ALTER TABLE walt.messages ADD COLUMN IF NOT EXISTS sources_used jsonb;--> statement-breakpoint

-- From 0021_perfect_psylocke (properties columns)
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS has_pool boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS iaqualink_device_serial text;--> statement-breakpoint

-- From 0021_perfect_psylocke (property_faqs column)
ALTER TABLE walt.property_faqs ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'unreviewed' NOT NULL;--> statement-breakpoint

-- From 0021_perfect_psylocke (reservations pricing + guest scoring)
ALTER TABLE walt.reservations ADD COLUMN IF NOT EXISTS total_price integer;--> statement-breakpoint
ALTER TABLE walt.reservations ADD COLUMN IF NOT EXISTS nightly_rate integer;--> statement-breakpoint
ALTER TABLE walt.reservations ADD COLUMN IF NOT EXISTS currency text;--> statement-breakpoint
ALTER TABLE walt.reservations ADD COLUMN IF NOT EXISTS guest_score integer;--> statement-breakpoint
ALTER TABLE walt.reservations ADD COLUMN IF NOT EXISTS guest_score_summary text;--> statement-breakpoint
ALTER TABLE walt.reservations ADD COLUMN IF NOT EXISTS guest_scored_at timestamp with time zone;--> statement-breakpoint

-- From 0022_strange_microbe (property details)
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS check_in_time text;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS check_out_time text;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS timezone text;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS max_guests integer;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS bedrooms integer;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS beds integer;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS bathrooms text;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS pets_allowed boolean;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS smoking_allowed boolean;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS events_allowed boolean;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS amenities text[];--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS description text;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS summary text;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS property_type text;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS room_type text;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS picture_url text;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS currency text;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS address_state text;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS country text;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS postcode text;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS address_number text;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS latitude double precision;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS longitude double precision;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS listings jsonb;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS room_details jsonb;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS tags text[];--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS public_name text;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS calendar_restricted boolean;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS parent_child jsonb;--> statement-breakpoint
ALTER TABLE walt.properties ADD COLUMN IF NOT EXISTS ical_imports jsonb;