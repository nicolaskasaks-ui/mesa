-- ═══════════════════════════════════════════════════════════
-- MIGRATION 001: Multi-tenant support (backward compatible)
-- Run this against Supabase SQL Editor
-- ════════════��══════════════════════════════════════════════

-- Step 1: Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  vertical        TEXT NOT NULL DEFAULT 'restaurant',
  address         TEXT,
  city            TEXT,
  country         TEXT DEFAULT 'AR',
  lat             NUMERIC(10, 7),
  lng             NUMERIC(10, 7),
  phone           TEXT,
  email           TEXT,
  website         TEXT,
  timezone        TEXT DEFAULT 'America/Argentina/Buenos_Aires',
  locale          TEXT DEFAULT 'es-AR',
  -- Branding
  logo_url        TEXT,
  favicon_url     TEXT,
  accent_color    TEXT DEFAULT '#1A1A1A',
  secondary_color TEXT DEFAULT '#2D7A4F',
  font_display    TEXT DEFAULT 'Outfit',
  font_body       TEXT DEFAULT 'Nunito',
  custom_css      TEXT,
  -- Custom domain
  custom_domain   TEXT UNIQUE,
  -- Operational
  pin             TEXT NOT NULL DEFAULT '0000',
  walk_around_radius_m  INT DEFAULT 300,
  walk_around_minutes   INT DEFAULT 15,
  arrival_minutes       INT DEFAULT 10,
  grace_minutes         INT DEFAULT 5,
  auto_cleanup_hours    INT DEFAULT 6,
  long_wait_hours       NUMERIC(3,1) DEFAULT 3.0,
  -- Feature toggles
  features        JSONB NOT NULL DEFAULT '{
    "bar_promo": false,
    "walk_around": false,
    "referral": false,
    "pre_order": false,
    "gps_tracking": false,
    "whatsapp_bot": true,
    "analytics": true,
    "crm": true
  }'::jsonb,
  -- External links
  opentable_url   TEXT,
  instagram_handle TEXT,
  instagram_url   TEXT,
  google_review_url TEXT,
  -- WhatsApp / Twilio
  twilio_phone_number   TEXT,
  uses_shared_number    BOOLEAN DEFAULT true,
  -- Billing
  plan            TEXT DEFAULT 'free'
                  CHECK (plan IN ('free', 'pro', 'growth', 'enterprise')),
  stripe_customer_id    TEXT,
  mp_customer_id        TEXT,
  billing_email         TEXT,
  -- Metadata
  onboarded_at    TIMESTAMPTZ,
  status          TEXT DEFAULT 'active'
                  CHECK (status IN ('active', 'suspended', 'churned', 'onboarding')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_custom_domain ON tenants(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Step 2: Seed Chuí as the first tenant
INSERT INTO tenants (
  id, slug, name, vertical, address, city, country, lat, lng,
  pin, logo_url, accent_color, secondary_color,
  opentable_url, instagram_handle, instagram_url, google_review_url,
  features, plan, status, onboarded_at
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'chui',
  'Chuí',
  'restaurant',
  'Loyola 1250, Villa Crespo',
  'Buenos Aires',
  'AR',
  -34.59013,
  -58.44112,
  '1250',
  '/logo-dark.png',
  '#1A1A1A',
  '#2D7A4F',
  'https://www.opentable.com/r/chui-buenos-aires',
  '@chui.ba',
  'https://instagram.com/chui.ba',
  'https://g.page/chui-ba/review',
  '{
    "bar_promo": true,
    "walk_around": true,
    "referral": true,
    "pre_order": true,
    "gps_tracking": true,
    "whatsapp_bot": true,
    "analytics": true,
    "crm": true
  }'::jsonb,
  'pro',
  'active',
  now()
) ON CONFLICT (slug) DO NOTHING;

-- Step 3: Add tenant_id to existing tables (nullable first)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='waitlist' AND column_name='tenant_id') THEN
    ALTER TABLE waitlist ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='tenant_id') THEN
    ALTER TABLE customers ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tables' AND column_name='tenant_id') THEN
    ALTER TABLE tables ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bar_redemptions' AND column_name='tenant_id') THEN
    ALTER TABLE bar_redemptions ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;
END $$;

-- Step 4: Backfill all existing data to Chuí
UPDATE waitlist SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE customers SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE tables SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE bar_redemptions SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- Step 5: Make NOT NULL (only if all rows have been backfilled)
-- Uncomment after verifying backfill:
-- ALTER TABLE waitlist ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE customers ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE tables ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE bar_redemptions ALTER COLUMN tenant_id SET NOT NULL;

-- Step 6: Add indexes for tenant queries
CREATE INDEX IF NOT EXISTS idx_waitlist_tenant ON waitlist(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tables_tenant ON tables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bar_redemptions_tenant ON bar_redemptions(tenant_id);

-- Step 7: Add preorders tenant_id if table exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='preorders') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='preorders' AND column_name='tenant_id') THEN
      ALTER TABLE preorders ADD COLUMN tenant_id UUID REFERENCES tenants(id);
      UPDATE preorders SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
    END IF;
  END IF;
END $$;

-- Enable realtime on tenants for config hot-reload
ALTER PUBLICATION supabase_realtime ADD TABLE tenants;
