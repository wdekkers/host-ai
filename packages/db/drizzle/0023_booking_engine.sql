CREATE TABLE IF NOT EXISTS walt.site_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id VARCHAR(80) NOT NULL,
  stripe_secret_key TEXT NOT NULL,
  stripe_webhook_secret TEXT NOT NULL,
  hospitable_api_key TEXT NOT NULL,
  service_fee_rate NUMERIC(5, 4) DEFAULT '0.05',
  tax_rate NUMERIC(5, 4) DEFAULT '0',
  damage_deposit_amount_cents INTEGER DEFAULT 0,
  hold_duration_minutes INTEGER DEFAULT 15,
  notification_emails TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS site_configs_site_id_idx
  ON walt.site_configs (site_id);

CREATE TABLE IF NOT EXISTS walt.inventory_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id VARCHAR(80) NOT NULL,
  property_id VARCHAR(120) NOT NULL,
  check_in TIMESTAMPTZ NOT NULL,
  check_out TIMESTAMPTZ NOT NULL,
  payment_intent_id VARCHAR(120),
  expires_at TIMESTAMPTZ NOT NULL,
  released BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_holds_site_id_idx
  ON walt.inventory_holds (site_id);
CREATE INDEX IF NOT EXISTS inventory_holds_site_property_idx
  ON walt.inventory_holds (site_id, property_id);
CREATE INDEX IF NOT EXISTS inventory_holds_expires_at_idx
  ON walt.inventory_holds (expires_at);

CREATE TABLE IF NOT EXISTS walt.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id VARCHAR(80) NOT NULL,
  hospitable_booking_id VARCHAR(120),
  property_id VARCHAR(120) NOT NULL,
  check_in TIMESTAMPTZ NOT NULL,
  check_out TIMESTAMPTZ NOT NULL,
  guest_name VARCHAR(160) NOT NULL,
  guest_email VARCHAR(254) NOT NULL,
  guest_phone VARCHAR(40),
  total_amount_cents INTEGER NOT NULL,
  payment_intent_id VARCHAR(120) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_site_id_idx
  ON walt.bookings (site_id);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_payment_intent_id_idx
  ON walt.bookings (payment_intent_id);
CREATE INDEX IF NOT EXISTS bookings_status_idx
  ON walt.bookings (status);
