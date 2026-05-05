-- Subscription plans: dynamic pricing & limits (admin-managed)

CREATE TABLE IF NOT EXISTS subscription_plans (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  price_azn NUMERIC(10,2) NOT NULL DEFAULT 0,
  student_limit INT NULL,          -- NULL => unlimited
  storage_gb NUMERIC(10,2) NULL,   -- NULL => unlimited
  sms_limit INT NULL,              -- NULL => unlimited
  ram_limit_mb INT NULL,           -- NULL => unlimited (optional)
  features JSONB NULL,             -- array of strings for UI (optional)
  highlight BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active);

-- Seed defaults (idempotent). Targets initial pricing:
-- Basic: 6 AZN, Pro: 10 AZN, Business: 19 AZN
INSERT INTO subscription_plans (slug, title, price_azn, student_limit, storage_gb, sms_limit, ram_limit_mb, features, highlight, is_active)
VALUES
  ('basic', 'BASIC', 6, 20, 1, 30, NULL, '["20 students","1GB storage","30 SMS"]'::jsonb, FALSE, TRUE),
  ('pro', 'PRO', 10, 100, 5, 200, NULL, '["100 students","5GB storage","200 SMS"]'::jsonb, TRUE, TRUE),
  ('business', 'BUSINESS', 19, NULL, 20, 500, NULL, '["Unlimited students","20GB storage","500 SMS"]'::jsonb, FALSE, TRUE)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  price_azn = EXCLUDED.price_azn,
  student_limit = EXCLUDED.student_limit,
  storage_gb = EXCLUDED.storage_gb,
  sms_limit = EXCLUDED.sms_limit,
  ram_limit_mb = EXCLUDED.ram_limit_mb,
  features = EXCLUDED.features,
  highlight = EXCLUDED.highlight,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

