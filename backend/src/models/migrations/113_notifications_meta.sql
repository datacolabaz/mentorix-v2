-- Bildiriş metadata (tapşırıq linki və s.)

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE is_read = FALSE;
