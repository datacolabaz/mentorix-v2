-- MANUAL rollback for migration 215_notification_preferences.sql.
-- This folder is NOT read by scripts/migrate.js. Never copy this file into src/models/migrations/.
--
-- Run only after the application code that reads notification_preferences has been rolled back.
-- Dropping the table discards every user's saved notification settings.
--
-- Usage (non-production first):  psql "$DATABASE_URL" -f backend/scripts/sql/rollback/215_notification_preferences.rollback.sql

BEGIN;

SET LOCAL lock_timeout = '10s';

DROP TABLE IF EXISTS notification_preferences;

DELETE FROM schema_migrations WHERE filename = '215_notification_preferences.sql';

COMMIT;
