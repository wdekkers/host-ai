CREATE TABLE IF NOT EXISTS walt.property_appliances (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  model_number TEXT,
  serial_number TEXT,
  location TEXT,
  purchase_date TIMESTAMPTZ,
  warranty_expiration TIMESTAMPTZ,
  photo_url TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS property_appliances_property_id_active_idx
  ON walt.property_appliances (property_id, is_active);
