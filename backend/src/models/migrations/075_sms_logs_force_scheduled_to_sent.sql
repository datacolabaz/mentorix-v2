BEGIN;

-- Ensure delivered_at exists (safe if 074 ran already).
ALTER TABLE sms_logs
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Force-fix legacy rows: if a message is still marked "scheduled" but its time is in the past,
-- mark it as "sent" and set delivered_at.
UPDATE sms_logs
SET
  status = 'sent',
  delivered_at = COALESCE(delivered_at, created_at, sent_at, NOW())
WHERE
  LOWER(TRIM(COALESCE(status, ''))) = 'scheduled'
  AND COALESCE(created_at, sent_at) IS NOT NULL
  AND COALESCE(created_at, sent_at) < NOW();

COMMIT;

