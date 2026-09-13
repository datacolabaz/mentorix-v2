-- Live recording quota V1: plan limits, retention, usage accounting.
-- Live lesson COUNT stays unlimited; only recordings are plan-controlled.

BEGIN;

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS recording_hours_monthly NUMERIC(10, 2) NULL,
  ADD COLUMN IF NOT EXISTS recording_storage_bytes BIGINT NULL,
  ADD COLUMN IF NOT EXISTS recording_retention_days INTEGER NULL,
  ADD COLUMN IF NOT EXISTS recording_max_duration_sec INTEGER NULL,
  ADD COLUMN IF NOT EXISTS recording_max_quality VARCHAR(16) NULL;

UPDATE subscription_plans
SET recording_hours_monthly = 0,
    recording_storage_bytes = 0,
    recording_retention_days = 0,
    recording_max_duration_sec = 0,
    recording_max_quality = NULL,
    updated_at = NOW()
WHERE slug = 'basic';

UPDATE subscription_plans
SET recording_hours_monthly = 5,
    recording_storage_bytes = 5368709120,
    recording_retention_days = 30,
    recording_max_duration_sec = 7200,
    recording_max_quality = '720p',
    updated_at = NOW()
WHERE slug = 'pro';

UPDATE subscription_plans
SET recording_hours_monthly = 20,
    recording_storage_bytes = 21474836480,
    recording_retention_days = 90,
    recording_max_duration_sec = 7200,
    recording_max_quality = '720p',
    updated_at = NOW()
WHERE slug = 'growth';

UPDATE subscription_plans
SET recording_hours_monthly = 50,
    recording_storage_bytes = 53687091200,
    recording_retention_days = 180,
    recording_max_duration_sec = 10800,
    recording_max_quality = '1080p',
    updated_at = NOW()
WHERE slug = 'premium';

ALTER TABLE live_recordings
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS storage_key VARCHAR(512) NULL,
  ADD COLUMN IF NOT EXISTS quota_period_ym VARCHAR(7) NULL,
  ADD COLUMN IF NOT EXISTS quota_duration_accounted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS quota_storage_accounted BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE live_recordings
SET storage_key = filename
WHERE storage_key IS NULL AND filename IS NOT NULL;

UPDATE live_recordings lr
SET expires_at = lr.created_at + (
  COALESCE(
    (
      SELECT sp.recording_retention_days
      FROM subscriptions s
      JOIN subscription_plans sp ON sp.slug = COALESCE(NULLIF(TRIM(s.plan), ''), 'basic')
      WHERE s.user_id = lr.instructor_id
      LIMIT 1
    ),
    30
  ) || ' days'
)::interval
WHERE lr.expires_at IS NULL AND lr.deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_live_recordings_expires
  ON live_recordings (expires_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_live_recordings_instructor_active
  ON live_recordings (instructor_id, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE usage_counters
  ADD COLUMN IF NOT EXISTS recording_seconds_used_monthly INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recording_period_ym VARCHAR(7) NULL;

COMMIT;
