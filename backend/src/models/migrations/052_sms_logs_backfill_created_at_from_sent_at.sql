-- Backfill created_at to reflect real send time for existing rows.
-- Some environments had created_at populated at migration time; prefer sent_at when it's older.

UPDATE sms_logs
SET created_at = sent_at
WHERE sent_at IS NOT NULL
  AND created_at IS NOT NULL
  AND created_at > sent_at + INTERVAL '60 seconds';

