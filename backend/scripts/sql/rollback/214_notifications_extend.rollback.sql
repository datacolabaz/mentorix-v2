-- MANUAL rollback for migration 214_notifications_extend.sql.
-- This folder is NOT read by scripts/migrate.js. Never copy this file into src/models/migrations/.
--
-- Run only after the application code that uses these columns has been rolled back
-- (otherwise the notification service/API will fail). Dropping columns discards
-- category/priority/dedupe/email_status data written since the deploy.
--
-- Usage (non-production first):  psql "$DATABASE_URL" -f backend/scripts/sql/rollback/214_notifications_extend.rollback.sql

BEGIN;

SET LOCAL lock_timeout = '10s';

DROP INDEX IF EXISTS idx_notifications_actor;
DROP INDEX IF EXISTS idx_notifications_group;
DROP INDEX IF EXISTS idx_notifications_workspace;
DROP INDEX IF EXISTS idx_notifications_entity;
DROP INDEX IF EXISTS idx_notifications_user_category;
DROP INDEX IF EXISTS idx_notifications_user_created;
DROP INDEX IF EXISTS uq_notifications_user_dedupe;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_category_check;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_priority_check;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_group_id_fkey;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_actor_user_id_fkey;

ALTER TABLE notifications
  DROP COLUMN IF EXISTS dedupe_key,
  DROP COLUMN IF EXISTS email_sent_at,
  DROP COLUMN IF EXISTS email_status,
  DROP COLUMN IF EXISTS read_at,
  DROP COLUMN IF EXISTS group_id,
  DROP COLUMN IF EXISTS provider_workspace_id,
  DROP COLUMN IF EXISTS actor_user_id,
  DROP COLUMN IF EXISTS related_entity_id,
  DROP COLUMN IF EXISTS related_entity_type,
  DROP COLUMN IF EXISTS priority,
  DROP COLUMN IF EXISTS category;

-- Allow a later re-apply of 214 by the runner.
DELETE FROM schema_migrations WHERE filename = '214_notifications_extend.sql';

COMMIT;
