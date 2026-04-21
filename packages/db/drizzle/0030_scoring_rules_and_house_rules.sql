CREATE TABLE IF NOT EXISTS walt.scoring_rules (
  id uuid PRIMARY KEY,
  organization_id text NOT NULL,
  rule_text text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

CREATE INDEX IF NOT EXISTS scoring_rules_org_idx
  ON walt.scoring_rules (organization_id);

ALTER TABLE walt.properties
  ADD COLUMN IF NOT EXISTS house_rules text;
