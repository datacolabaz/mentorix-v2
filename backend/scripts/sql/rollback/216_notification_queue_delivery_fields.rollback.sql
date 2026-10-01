-- MANUAL rollback for migration 216_notification_queue_delivery_fields.sql.
-- This folder is NOT read by scripts/migrate.js. Never copy this file into src/models/migrations/.
--
-- Run only after the application code that uses these columns has been rolled back
-- (the outbox worker and notificationService write them). Dropping the columns discards
-- delivery history (provider ids, failure codes, timestamps) written since the deploy.
-- Notification emails are queued with status 'queued' (retries go back to 'queued'), and the
-- new worker leaves 'sending' / 'dry_run' / 'skipped' / 'suppressed'. The old worker only picks
-- 'pending' / 'retrying', so a code-only rollback never sends these rows either.
--
-- Usage (non-production first):
--   psql "$DATABASE_URL" -f backend/scripts/sql/rollback/216_notification_queue_delivery_fields.rollback.sql

BEGIN;

SET LOCAL lock_timeout = '10s';

-- Never let the old SMTP worker pick up notification emails that were queued by the new pipeline.
UPDATE notification_queue
SET status = 'suppressed', updated_at = NOW()
WHERE notification_id IS NOT NULL AND status IN ('queued', 'pending', 'retrying', 'sending');

-- Legacy rows caught mid-send: the old worker never reads 'sending', so hand them back to it.
UPDATE notification_queue
SET status = 'retrying', updated_at = NOW()
WHERE template_key IS NULL AND status = 'sending';

DROP INDEX IF EXISTS idx_notification_queue_sending;
DROP INDEX IF EXISTS idx_notification_queue_failed;
DROP INDEX IF EXISTS idx_notification_queue_notification;

ALTER TABLE notification_queue DROP CONSTRAINT IF EXISTS notification_queue_notification_id_fkey;

ALTER TABLE notification_queue
  DROP COLUMN IF EXISTS locked_at,
  DROP COLUMN IF EXISTS error_message_safe,
  DROP COLUMN IF EXISTS error_code,
  DROP COLUMN IF EXISTS failed_at,
  DROP COLUMN IF EXISTS delivered_at,
  DROP COLUMN IF EXISTS attempted_at,
  DROP COLUMN IF EXISTS locale,
  DROP COLUMN IF EXISTS template_key,
  DROP COLUMN IF EXISTS provider_message_id,
  DROP COLUMN IF EXISTS provider,
  DROP COLUMN IF EXISTS notification_id;

-- Allow a later re-apply of 216 by the runner.
DELETE FROM schema_migrations WHERE filename = '216_notification_queue_delivery_fields.sql';

COMMIT;
