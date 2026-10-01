-- Pending SMS top-ups (SMS is retired) are decided one by one by an admin: "refund" (status 'refunded'
-- + note; the money is returned outside the app) or "convert to credit" (status 'credited' + a credit
-- that is applied automatically to the teacher's next plan / storage checkout). Nothing is automatic:
-- the reaper no longer expires SMS rows, and approving them is blocked in code.
-- Every decision is audited in admin_access_audit (reason required).
-- Rollback (manual): backend/scripts/sql/rollback/230_sms_topup_decisions.rollback.sql

SET LOCAL lock_timeout = '10s';

ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS credit_applied_cents INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS billing_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  remaining_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AZN',
  source TEXT NOT NULL DEFAULT 'sms_topup_conversion',
  source_payment_id UUID REFERENCES billing_payments(id) ON DELETE SET NULL,
  reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE billing_credits DROP CONSTRAINT IF EXISTS billing_credits_amounts_check;
ALTER TABLE billing_credits
  ADD CONSTRAINT billing_credits_amounts_check
  CHECK (amount_cents > 0 AND remaining_cents >= 0 AND remaining_cents <= amount_cents) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_credits_source_payment
  ON billing_credits (source_payment_id) WHERE source_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_credits_user_open
  ON billing_credits (user_id, created_at) WHERE remaining_cents > 0;

CREATE TABLE IF NOT EXISTS billing_credit_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id UUID NOT NULL REFERENCES billing_credits(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES billing_payments(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE billing_credit_applications DROP CONSTRAINT IF EXISTS billing_credit_applications_check;
ALTER TABLE billing_credit_applications
  ADD CONSTRAINT billing_credit_applications_check
  CHECK (amount_cents > 0 AND status IN ('reserved', 'consumed', 'released')) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_credit_applications_pair
  ON billing_credit_applications (credit_id, payment_id);
CREATE INDEX IF NOT EXISTS idx_billing_credit_applications_payment
  ON billing_credit_applications (payment_id);

COMMENT ON COLUMN billing_payments.credit_applied_cents IS
  'Account credit (billing_credits) applied to this payment; amount_cents is what the teacher still pays.';
COMMENT ON TABLE billing_credits IS
  'Account credit, e.g. a retired SMS top-up converted by an admin (audited). Applied FIFO at checkout.';
