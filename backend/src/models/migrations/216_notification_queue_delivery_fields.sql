-- Phase B: `notification_queue` becomes the single email outbox + delivery log
-- (the spec's notification_deliveries fields), instead of a second outbox table.
-- Additive and idempotent: nullable columns only (no table rewrite), partial indexes,
-- no backfill, no CHECK on status (existing values keep working; enforced in code).
-- Rollback (manual): backend/scripts/sql/rollback/216_notification_queue_delivery_fields.rollback.sql

SET LOCAL lock_timeout = '10s';

ALTER TABLE notification_queue
  ADD COLUMN IF NOT EXISTS notification_id UUID,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS template_key TEXT,
  ADD COLUMN IF NOT EXISTS locale VARCHAR(8),
  ADD COLUMN IF NOT EXISTS attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS error_message_safe TEXT,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- NOT VALID: no scan of existing rows (they all have notification_id NULL anyway).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notification_queue_notification_id_fkey' AND conrelid = 'notification_queue'::regclass
  ) THEN
    ALTER TABLE notification_queue
      ADD CONSTRAINT notification_queue_notification_id_fkey
      FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

-- Link notification → delivery rows (and ON DELETE SET NULL without a full scan).
CREATE INDEX IF NOT EXISTS idx_notification_queue_notification
  ON notification_queue (notification_id)
  WHERE notification_id IS NOT NULL;

-- Admin ops summary (Phase E): recent failed email deliveries.
CREATE INDEX IF NOT EXISTS idx_notification_queue_failed
  ON notification_queue (failed_at DESC)
  WHERE status = 'failed';

-- Stale-claim recovery for the SKIP LOCKED worker.
CREATE INDEX IF NOT EXISTS idx_notification_queue_sending
  ON notification_queue (locked_at)
  WHERE status = 'sending';
