-- MANUAL rollback for migration 229_legacy_plan_migrations.sql.
-- This folder is NOT read by scripts/migrate.js. Never copy this file into src/models/migrations/.
-- Dropping the table forgets which legacy subscribers were notified (export it first if needed).
--
-- Usage (non-production first):  psql "$DATABASE_URL" -f backend/scripts/sql/rollback/229_legacy_plan_migrations.rollback.sql

BEGIN;

SET LOCAL lock_timeout = '10s';

DROP TABLE IF EXISTS legacy_plan_migrations;

DELETE FROM schema_migrations WHERE filename = '229_legacy_plan_migrations.sql';

COMMIT;
