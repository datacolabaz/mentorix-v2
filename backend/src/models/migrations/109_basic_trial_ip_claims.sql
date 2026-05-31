-- One SADƏ 14-day trial per IP (abuse prevention)

BEGIN;

CREATE TABLE IF NOT EXISTS basic_trial_ip_claims (
  ip TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS basic_trial_ip_claims_user_id
  ON basic_trial_ip_claims (user_id);

CREATE TABLE IF NOT EXISTS basic_trial_ip_denials (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ip TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'ip_already_claimed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
