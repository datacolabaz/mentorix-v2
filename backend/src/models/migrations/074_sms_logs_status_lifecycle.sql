BEGIN;

-- Add delivery timestamp for stable "sent" semantics.
ALTER TABLE sms_logs
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Normalize legacy provider statuses into stable lifecycle statuses.
-- Rule of thumb:
-- - failed:* or failed => failed
-- - pending => pending
-- - scheduled with successful HTTP => sent (provider sometimes returns "scheduled" for immediate send)
-- - any other non-empty status with successful HTTP => sent
UPDATE sms_logs
SET
  status = 'sent',
  delivered_at = COALESCE(delivered_at, created_at, sent_at, NOW())
WHERE
  -- only when we have strong-ish evidence request succeeded
  (http_status IS NOT NULL AND http_status >= 200 AND http_status < 300)
  AND (
    LOWER(TRIM(status)) = 'scheduled'
    OR (
      LOWER(TRIM(status)) NOT IN ('sent','failed','pending','scheduled')
      AND status NOT ILIKE 'failed:%'
    )
  );

COMMIT;

