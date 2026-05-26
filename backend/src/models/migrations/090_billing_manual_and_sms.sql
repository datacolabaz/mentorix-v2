-- Manual (cash) billing + extra SMS purchases

BEGIN;

ALTER TABLE usage_counters
  ADD COLUMN IF NOT EXISTS extra_sms_balance INTEGER NOT NULL DEFAULT 0;

ALTER TABLE billing_payments
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'card',
  ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'plan',
  ADD COLUMN IF NOT EXISTS sms_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS admin_note TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS billing_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO billing_settings (key, value)
VALUES
  ('manual_transfer_account', '000000000000'),
  (
    'sms_packs',
    '[{"quantity":50,"price_azn":10,"label":"50 SMS"},{"quantity":100,"price_azn":18,"label":"100 SMS"},{"quantity":200,"price_azn":32,"label":"200 SMS"}]'
  )
ON CONFLICT (key) DO NOTHING;

COMMIT;
