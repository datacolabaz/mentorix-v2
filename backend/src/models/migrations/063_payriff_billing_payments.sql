-- Payriff billing payments + subscription lifecycle helpers

CREATE TABLE IF NOT EXISTS billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'payriff',
  plan TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AZN',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed
  external_order_id TEXT,
  payment_url TEXT,
  raw_create_response JSONB,
  raw_callback JSONB,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_payments_external_order_unique
  ON billing_payments (provider, external_order_id)
  WHERE external_order_id IS NOT NULL AND external_order_id <> '';

CREATE INDEX IF NOT EXISTS billing_payments_user_created_at
  ON billing_payments (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS billing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- upgrade | downgrade | payment
  old_plan TEXT,
  new_plan TEXT,
  amount_cents INTEGER,
  currency TEXT DEFAULT 'AZN',
  status TEXT NOT NULL, -- pending | paid | failed | scheduled
  provider TEXT,
  external_order_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS billing_history_user_created_at
  ON billing_history (user_id, created_at DESC);

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS pending_plan TEXT,
  ADD COLUMN IF NOT EXISTS pending_effective_at TIMESTAMPTZ;

