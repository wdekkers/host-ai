ALTER TABLE walt.reservations
  ADD COLUMN IF NOT EXISTS guest_risk_level text,
  ADD COLUMN IF NOT EXISTS guest_trust_level text;

CREATE TABLE IF NOT EXISTS walt.guest_assessments (
  id uuid PRIMARY KEY,
  reservation_id text NOT NULL,
  organization_id text NOT NULL,
  score integer NOT NULL,
  summary text NOT NULL,
  risk_level text NOT NULL CHECK (risk_level IN ('low','medium','high')),
  trust_level text NOT NULL CHECK (trust_level IN ('low','medium','high')),
  recommendation text NOT NULL,
  signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  rules_acceptance jsonb NOT NULL,
  trigger text NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  inputs_hash text NOT NULL,
  source_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);
CREATE INDEX IF NOT EXISTS guest_assessments_reservation_idx
  ON walt.guest_assessments (reservation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS guest_assessments_org_idx
  ON walt.guest_assessments (organization_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS guest_assessments_reservation_msg_uniq
  ON walt.guest_assessments (reservation_id, source_message_id)
  WHERE source_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS walt.risk_signals_catalog (
  id uuid PRIMARY KEY,
  organization_id text NOT NULL,
  label text NOT NULL,
  dimension text NOT NULL CHECK (dimension IN
    ('booking_pattern','profile','language','policy_violation')),
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  valence text NOT NULL CHECK (valence IN ('risk','trust','neutral')),
  active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS risk_signals_catalog_org_idx
  ON walt.risk_signals_catalog (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS risk_signals_catalog_org_label_uniq
  ON walt.risk_signals_catalog (organization_id, label);

CREATE TABLE IF NOT EXISTS walt.property_signal_overrides (
  id uuid PRIMARY KEY,
  property_id text NOT NULL,
  catalog_item_id uuid NOT NULL,
  severity text CHECK (severity IS NULL OR severity IN ('low','medium','high','critical')),
  active boolean,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS property_signal_overrides_uniq
  ON walt.property_signal_overrides (property_id, catalog_item_id);

CREATE TABLE IF NOT EXISTS walt.guest_incidents (
  id uuid PRIMARY KEY,
  organization_id text NOT NULL,
  guest_first_name text,
  guest_last_name text,
  reservation_id text,
  property_id text,
  incident_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low','medium','high')),
  notes text,
  source text NOT NULL CHECK (source IN ('manual','review_extracted')),
  status text NOT NULL CHECK (status IN ('suggested','confirmed','dismissed')),
  source_review_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  reviewed_at timestamptz,
  reviewed_by text
);
CREATE INDEX IF NOT EXISTS guest_incidents_org_name_idx
  ON walt.guest_incidents (organization_id, guest_last_name, guest_first_name);
CREATE INDEX IF NOT EXISTS guest_incidents_status_idx
  ON walt.guest_incidents (status);
