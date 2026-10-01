-- MANUAL rollback for migration 232_student_parent_email.sql.
-- This folder is NOT read by scripts/migrate.js. Never copy this file into src/models/migrations/.
-- Dropping the columns deletes every saved parent contact email and its unsubscribe state.
-- Deploy the previous backend first: the current code reads these columns.
--
-- Usage (non-production first):  psql "$DATABASE_URL" -f backend/scripts/sql/rollback/232_student_parent_email.rollback.sql

BEGIN;

SET LOCAL lock_timeout = '10s';

ALTER TABLE student_profiles DROP CONSTRAINT IF EXISTS student_profiles_parent_email_len_chk;
ALTER TABLE student_profiles DROP COLUMN IF EXISTS parent_email_opt_out_at;
ALTER TABLE student_profiles DROP COLUMN IF EXISTS parent_email;

DELETE FROM schema_migrations WHERE filename = '232_student_parent_email.sql';

COMMIT;
