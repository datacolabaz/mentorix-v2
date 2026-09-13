-- Partner / Referral program (non-destructive).
-- Does NOT reuse unused `referrals` table.
-- Commission hooks into existing billing_payments + fulfillBillingPayment.

BEGIN;

-- ---------------------------------------------------------------------------
-- Campaigns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  trial_days INT NOT NULL DEFAULT 21 CHECK (trial_days > 0 AND trial_days <= 365),
  user_discount_pct INT NOT NULL DEFAULT 10 CHECK (user_discount_pct >= 0 AND user_discount_pct <= 100),
  discount_duration_months INT NOT NULL DEFAULT 3 CHECK (discount_duration_months >= 0 AND discount_duration_months <= 36),
  commission_pct INT NOT NULL DEFAULT 20 CHECK (commission_pct >= 0 AND commission_pct <= 100),
  commission_duration_months INT NOT NULL DEFAULT 0 CHECK (commission_duration_months >= 0 AND commission_duration_months <= 36),
  attribution_window_days INT NOT NULL DEFAULT 90 CHECK (attribution_window_days > 0 AND attribution_window_days <= 730),
  minimum_payout_cents INT NOT NULL DEFAULT 2000 CHECK (minimum_payout_cents >= 0),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS partner_campaigns_one_default
  ON partner_campaigns ((is_default))
  WHERE is_default = TRUE AND is_active = TRUE;

-- ---------------------------------------------------------------------------
-- Partners
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  default_campaign_id UUID REFERENCES partner_campaigns(id) ON DELETE SET NULL,
  apply_note TEXT,
  admin_note TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  suspended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS partners_status_created_at
  ON partners (status, created_at DESC);

CREATE TABLE IF NOT EXISTS partner_profiles (
  partner_id UUID PRIMARY KEY REFERENCES partners(id) ON DELETE CASCADE,
  display_name TEXT,
  phone TEXT,
  payout_iban TEXT,
  payout_bank_name TEXT,
  payout_account_holder TEXT,
  city TEXT,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Links + codes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_referral_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES partner_campaigns(id) ON DELETE SET NULL,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS partner_referral_links_partner
  ON partner_referral_links (partner_id, is_active);

CREATE TABLE IF NOT EXISTS partner_referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES partner_referral_links(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT partner_referral_codes_code_format CHECK (code ~ '^[a-zA-Z0-9_-]{4,32}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS partner_referral_codes_code_lower
  ON partner_referral_codes (lower(code));

CREATE INDEX IF NOT EXISTS partner_referral_codes_partner
  ON partner_referral_codes (partner_id);

CREATE TABLE IF NOT EXISTS partner_referral_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES partner_referral_links(id) ON DELETE CASCADE,
  code_id UUID REFERENCES partner_referral_codes(id) ON DELETE SET NULL,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES partner_campaigns(id) ON DELETE SET NULL,
  session_key TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  landing_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS partner_referral_clicks_partner_created
  ON partner_referral_clicks (partner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS partner_referral_clicks_session
  ON partner_referral_clicks (session_key, created_at DESC)
  WHERE session_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Attributions (one locked partner per invited user; admin-manual only overwrite)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invited_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  link_id UUID REFERENCES partner_referral_links(id) ON DELETE SET NULL,
  code_id UUID REFERENCES partner_referral_codes(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES partner_campaigns(id) ON DELETE SET NULL,
  click_id UUID REFERENCES partner_referral_clicks(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'cookie'
    CHECK (source IN ('cookie', 'query', 'register_body', 'admin_manual')),
  attributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_expires_at TIMESTAMPTZ NOT NULL,
  locked BOOLEAN NOT NULL DEFAULT TRUE,
  self_referral_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS partner_attributions_partner
  ON partner_attributions (partner_id, attributed_at DESC);

CREATE INDEX IF NOT EXISTS partner_attributions_window
  ON partner_attributions (window_expires_at)
  WHERE self_referral_blocked = FALSE;

-- ---------------------------------------------------------------------------
-- Commissions + payouts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attribution_id UUID NOT NULL REFERENCES partner_attributions(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES partner_campaigns(id) ON DELETE SET NULL,
  billing_payment_id UUID NOT NULL REFERENCES billing_payments(id) ON DELETE CASCADE,
  period_index INT NOT NULL CHECK (period_index >= 1),
  plan TEXT,
  gross_amount_cents INT NOT NULL CHECK (gross_amount_cents >= 0),
  discount_cents INT NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  net_amount_cents INT NOT NULL CHECK (net_amount_cents >= 0),
  commission_pct INT NOT NULL CHECK (commission_pct >= 0 AND commission_pct <= 100),
  commission_cents INT NOT NULL CHECK (commission_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'AZN',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid', 'void')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT partner_commissions_billing_payment_unique UNIQUE (billing_payment_id)
);

CREATE INDEX IF NOT EXISTS partner_commissions_partner_status
  ON partner_commissions (partner_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS partner_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'AZN',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  admin_note TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS partner_payouts_partner_status
  ON partner_payouts (partner_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS partner_payout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID NOT NULL REFERENCES partner_payouts(id) ON DELETE CASCADE,
  commission_id UUID NOT NULL REFERENCES partner_commissions(id) ON DELETE RESTRICT,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT partner_payout_items_commission_unique UNIQUE (commission_id)
);

CREATE INDEX IF NOT EXISTS partner_payout_items_payout
  ON partner_payout_items (payout_id);

-- ---------------------------------------------------------------------------
-- Audit trail (attribution overwrite, status changes, payouts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS partner_audit_events_created
  ON partner_audit_events (created_at DESC);

CREATE INDEX IF NOT EXISTS partner_audit_events_partner
  ON partner_audit_events (partner_id, created_at DESC);

-- Optional FK on billing payments (nullable; non-breaking)
ALTER TABLE billing_payments
  ADD COLUMN IF NOT EXISTS partner_attribution_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'billing_payments_partner_attribution_id_fkey'
  ) THEN
    ALTER TABLE billing_payments
      ADD CONSTRAINT billing_payments_partner_attribution_id_fkey
      FOREIGN KEY (partner_attribution_id) REFERENCES partner_attributions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS billing_payments_partner_attribution
  ON billing_payments (partner_attribution_id)
  WHERE partner_attribution_id IS NOT NULL;

-- Configurable platform trial (new grants only; existing mid-trial rows keep period_end via COALESCE)
INSERT INTO billing_settings (key, value, updated_at)
VALUES ('trial_duration_days', '21', NOW())
ON CONFLICT (key) DO NOTHING;

-- Default launch campaign
INSERT INTO partner_campaigns (
  slug, title, description, is_active, is_default,
  trial_days, user_discount_pct, discount_duration_months,
  commission_pct, commission_duration_months,
  attribution_window_days, minimum_payout_cents
)
VALUES (
  'mentorix-partner-launch',
  'Mentorix Partner Launch Campaign',
  'V2: 21-day trial, 10% user discount for first 3 paid months on original package (lost on upgrade), 20% partner commission on every approved payment while customer pays, 90-day attribution, 20 AZN min payout.',
  TRUE,
  TRUE,
  21, 10, 3,
  20, 0,
  90, 2000
)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
