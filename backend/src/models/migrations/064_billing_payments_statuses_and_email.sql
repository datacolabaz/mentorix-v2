-- Extend billing_payments statuses + minimal email reminder tracking.

-- Allow 'expired' status for abandoned payments (used by reaper cron).
-- (We don't enforce enum in DB, but keep comments here.)

ALTER TABLE billing_payments
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS grace_until TIMESTAMPTZ;

