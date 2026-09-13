-- Minimal click attribution source for partner analytics (UTM / referrer)
ALTER TABLE partner_referral_clicks
  ADD COLUMN IF NOT EXISTS referrer_source VARCHAR(32),
  ADD COLUMN IF NOT EXISTS utm_source VARCHAR(128),
  ADD COLUMN IF NOT EXISTS referrer_url TEXT;

CREATE INDEX IF NOT EXISTS partner_referral_clicks_partner_source
  ON partner_referral_clicks (partner_id, referrer_source, created_at DESC);
