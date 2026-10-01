-- MANUAL rollback for migration 226_live_lessons_external_links.sql.
-- This folder is NOT read by scripts/migrate.js. Never copy this file into src/models/migrations/.
--
-- Run only after the application code that reads these columns has been rolled back.
-- DATA LOSS WARNING: drops manual attendance, lesson descriptions, materials, recurrence and
-- cancellation data. Export first if needed:
--   \copy (SELECT * FROM live_lesson_attendance) TO 'live_lesson_attendance.csv' CSV HEADER
--   \copy (SELECT id, description, ends_at, duration_minutes, student_id, reminder_offset_minutes, notify_email,
--          recurrence_rule, series_id, link_source, materials, cancelled_at, cancel_reason FROM live_rooms) TO 'live_rooms_226.csv' CSV HEADER
-- Rows with provider='other' or status='cancelled' are kept; the old CHECKs are re-added NOT VALID.
--
-- Usage (non-production first):  psql "$DATABASE_URL" -f backend/scripts/sql/rollback/226_live_lessons_external_links.rollback.sql

BEGIN;

SET LOCAL lock_timeout = '10s';

DROP TABLE IF EXISTS live_lesson_attendance;

DROP INDEX IF EXISTS idx_live_rooms_reminder_due;
DROP INDEX IF EXISTS idx_live_rooms_series;
DROP INDEX IF EXISTS idx_live_rooms_student;
DROP INDEX IF EXISTS idx_live_rooms_group_scheduled;

ALTER TABLE live_rooms DROP CONSTRAINT IF EXISTS live_rooms_student_id_fkey;
ALTER TABLE live_rooms DROP CONSTRAINT IF EXISTS live_rooms_link_source_check;
ALTER TABLE live_rooms DROP CONSTRAINT IF EXISTS live_rooms_reminder_offset_check;

ALTER TABLE live_rooms DROP CONSTRAINT IF EXISTS live_rooms_status_check;
ALTER TABLE live_rooms
  ADD CONSTRAINT live_rooms_status_check CHECK (status IN ('waiting', 'live', 'ended')) NOT VALID;

ALTER TABLE live_rooms DROP CONSTRAINT IF EXISTS live_rooms_provider_check;
ALTER TABLE live_rooms
  ADD CONSTRAINT live_rooms_provider_check CHECK (provider IN ('mentorix_live', 'google_meet', 'zoom', 'teams')) NOT VALID;

ALTER TABLE live_rooms
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS ends_at,
  DROP COLUMN IF EXISTS duration_minutes,
  DROP COLUMN IF EXISTS student_id,
  DROP COLUMN IF EXISTS reminder_offset_minutes,
  DROP COLUMN IF EXISTS notify_email,
  DROP COLUMN IF EXISTS recurrence_rule,
  DROP COLUMN IF EXISTS series_id,
  DROP COLUMN IF EXISTS link_source,
  DROP COLUMN IF EXISTS materials,
  DROP COLUMN IF EXISTS cancelled_at,
  DROP COLUMN IF EXISTS cancel_reason,
  DROP COLUMN IF EXISTS reminder_sent_at,
  DROP COLUMN IF EXISTS updated_at;

DELETE FROM schema_migrations WHERE filename = '226_live_lessons_external_links.sql';

COMMIT;
