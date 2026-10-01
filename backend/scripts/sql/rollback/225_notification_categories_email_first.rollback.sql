-- MANUAL rollback for migration 225_notification_categories_email_first.sql.
-- This folder is NOT read by scripts/migrate.js. Never copy this file into src/models/migrations/.
--
-- Run only after the application code that writes the new categories has been rolled back.
-- Preference rows of the new categories are deleted (they would violate the old constraint).
-- Notifications keep their rows; the old CHECK is re-added NOT VALID, so existing rows are not re-checked.
--
-- Usage (non-production first):  psql "$DATABASE_URL" -f backend/scripts/sql/rollback/225_notification_categories_email_first.rollback.sql

BEGIN;

SET LOCAL lock_timeout = '10s';

DELETE FROM notification_preferences WHERE category IN ('live_lesson', 'parent', 'digest', 'marketing');

ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_category_check;
ALTER TABLE notification_preferences
  ADD CONSTRAINT notification_preferences_category_check
  CHECK (category IN ('security', 'assessment', 'assignment', 'material', 'group', 'grading', 'partner', 'billing', 'system')) NOT VALID;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_category_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_category_check
  CHECK (
    category IS NULL
    OR category IN ('security', 'assessment', 'assignment', 'material', 'group', 'grading', 'partner', 'billing', 'system')
  ) NOT VALID;

DELETE FROM schema_migrations WHERE filename = '225_notification_categories_email_first.sql';

COMMIT;
