-- Trials + risk logs + referrals.
-- Goal: backend-enforced trial limits (duration + max students + daily add limit)
-- and minimal abuse/risk tracking.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_provider TEXT;

-- Core trial row per instructor/user. Keep it generic (any role could trial),
-- but enforcement will be applied to instructors in middleware.
CREATE TABLE IF NOT EXISTS trials (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  max_students INTEGER NOT NULL DEFAULT 5,
  used_students INTEGER NOT NULL DEFAULT 0,
  daily_student_limit INTEGER NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trials_active_by_end
  ON trials (is_active, end_date);

-- Daily usage for "daily_student_limit". One row per user per Baku day (YYYY-MM-DD).
CREATE TABLE IF NOT EXISTS trial_daily_usage (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ymd TEXT NOT NULL,
  used_students INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, ymd)
);

-- Referral graph: inviter -> invited. Activation is marked when invited meets conditions.
CREATE TABLE IF NOT EXISTS referrals (
  inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  PRIMARY KEY (inviter_id, invited_id)
);

-- Minimal risk logs: store signals + score. (soft restriction decisions are app-side)
CREATE TABLE IF NOT EXISTS risk_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ip TEXT,
  device_id TEXT,
  risk_score INTEGER NOT NULL DEFAULT 0,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS risk_logs_user_created_at
  ON risk_logs (user_id, created_at DESC);

