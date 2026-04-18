-- Expand sms_logs so we can store full provider diagnostics (VARCHAR(20) was too small).

ALTER TABLE sms_logs
  ALTER COLUMN status TYPE TEXT;

ALTER TABLE sms_logs
  ADD COLUMN IF NOT EXISTS http_status INTEGER,
  ADD COLUMN IF NOT EXISTS msisdn TEXT,
  ADD COLUMN IF NOT EXISTS provider JSONB;
