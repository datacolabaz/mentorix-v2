-- Add contextual fields to sms_logs for real history UI (backward compatible).

ALTER TABLE sms_logs
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS type VARCHAR(32),
  ADD COLUMN IF NOT EXISTS package_type VARCHAR(32),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Backfill created_at from sent_at when available.
UPDATE sms_logs
SET created_at = COALESCE(created_at, sent_at, NOW())
WHERE created_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sms_logs_instructor_id_created_at ON sms_logs (instructor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_logs_student_id_created_at ON sms_logs (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_logs_type_created_at ON sms_logs (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status_created_at ON sms_logs (status, created_at DESC);

