-- MANUAL rollback for migration 228_sms_deprecation.sql (comments only; no data involved).
-- This folder is NOT read by scripts/migrate.js. Never copy this file into src/models/migrations/.
--
-- Usage (non-production first):  psql "$DATABASE_URL" -f backend/scripts/sql/rollback/228_sms_deprecation.rollback.sql

BEGIN;

SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
  item RECORD;
BEGIN
  IF to_regclass('public.sms_logs') IS NOT NULL THEN
    EXECUTE 'COMMENT ON TABLE sms_logs IS NULL';
  END IF;
  FOR item IN
    SELECT * FROM (VALUES
      ('usage_counters', 'sms_used_monthly'),
      ('usage_counters', 'sms_period_ym'),
      ('usage_counters', 'extra_sms_balance'),
      ('billing_payments', 'sms_quantity'),
      ('instructor_profiles', 'sms_used'),
      ('instructor_profiles', 'sms_limit'),
      ('trials', 'sms_limit_monthly')
    ) AS t(tbl, col)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = item.tbl AND column_name = item.col
    ) THEN
      EXECUTE format('COMMENT ON COLUMN %I.%I IS NULL', item.tbl, item.col);
    END IF;
  END LOOP;
END $$;

DELETE FROM schema_migrations WHERE filename = '228_sms_deprecation.sql';

COMMIT;
