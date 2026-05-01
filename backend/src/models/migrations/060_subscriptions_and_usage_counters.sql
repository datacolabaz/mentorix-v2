-- Subscriptions + usage counters (pricing enforcement source of truth)

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'basic',
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  provider TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscriptions_plan_status
  ON subscriptions (plan, status);

CREATE TABLE IF NOT EXISTS usage_counters (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  students_count INTEGER NOT NULL DEFAULT 0,
  storage_used_mb INTEGER NOT NULL DEFAULT 0,
  sms_used_monthly INTEGER NOT NULL DEFAULT 0,
  sms_period_ym TEXT NOT NULL DEFAULT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku'), 'YYYY-MM'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure trial table has optional trial-specific limits for storage + sms.
ALTER TABLE trials
  ADD COLUMN IF NOT EXISTS storage_limit_mb INTEGER,
  ADD COLUMN IF NOT EXISTS sms_limit_monthly INTEGER;

-- Backfill minimal rows for existing instructors (safe no-op if none).
INSERT INTO subscriptions (user_id, plan, status)
SELECT u.id, 'pro', 'active'
FROM users u
WHERE u.role = 'instructor'
  AND u.is_active = TRUE
  AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id);

INSERT INTO usage_counters (user_id, students_count, storage_used_mb, sms_used_monthly, sms_period_ym)
SELECT
  u.id,
  COALESCE((
    SELECT COUNT(*)::int
    FROM enrollments e
    WHERE e.instructor_id = u.id AND e.status = 'active'
  ), 0) AS students_count,
  COALESCE(ip.storage_used_mb, 0) AS storage_used_mb,
  COALESCE(ip.sms_used, 0) AS sms_used_monthly,
  to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku'), 'YYYY-MM') AS sms_period_ym
FROM users u
LEFT JOIN instructor_profiles ip ON ip.user_id = u.id
WHERE u.role = 'instructor'
  AND u.is_active = TRUE
  AND NOT EXISTS (SELECT 1 FROM usage_counters uc WHERE uc.user_id = u.id);

