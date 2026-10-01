-- SMS is retired (email is the notification channel). Nothing is dropped or rewritten here:
-- historical SMS logs, counters and purchases stay readable. Columns/tables are only marked
-- DEPRECATED so the later-drop plan (specs/audit-sms-video-pricing.md) can remove them safely.
-- Every statement is guarded, so environments without a given table/column still migrate.
-- Rollback (manual): backend/scripts/sql/rollback/228_sms_deprecation.rollback.sql

SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
  item RECORD;
BEGIN
  IF to_regclass('public.sms_logs') IS NOT NULL THEN
    EXECUTE $c$COMMENT ON TABLE sms_logs IS 'DEPRECATED: SMS retired. Historical log, read-only. Drop per the later-drop plan.'$c$;
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
      EXECUTE format(
        'COMMENT ON COLUMN %I.%I IS %L',
        item.tbl, item.col,
        'DEPRECATED: SMS retired. Not read or written by the app. Drop per the later-drop plan.'
      );
    END IF;
  END LOOP;
END $$;
