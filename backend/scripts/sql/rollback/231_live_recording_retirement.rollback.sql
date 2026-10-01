-- MANUAL rollback for migration 231_live_recording_retirement.sql.
-- This folder is NOT read by scripts/migrate.js. Never copy this file into src/models/migrations/.
-- Dropping the column forgets who was notified; a later re-deploy would notify those teachers again
-- (and restart their 30-day window). Keep LIVE_RECORDING_PURGE_ENABLED unset while rolled back.
--
-- Usage (non-production first):  psql "$DATABASE_URL" -f backend/scripts/sql/rollback/231_live_recording_retirement.rollback.sql

BEGIN;

SET LOCAL lock_timeout = '10s';

DROP INDEX IF EXISTS idx_live_recordings_retirement_pending;
DROP INDEX IF EXISTS idx_live_recordings_retirement_noticed;
ALTER TABLE live_recordings DROP COLUMN IF EXISTS retirement_notice_sent_at;

DELETE FROM schema_migrations WHERE filename = '231_live_recording_retirement.sql';

COMMIT;
