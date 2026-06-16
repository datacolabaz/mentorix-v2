-- Slack-style online status: last authenticated activity per user.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_users_last_activity_at
  ON users (last_activity_at DESC NULLS LAST)
  WHERE deleted_at IS NULL;

COMMIT;
