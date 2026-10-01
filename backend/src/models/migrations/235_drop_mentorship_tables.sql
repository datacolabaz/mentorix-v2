-- Delete the retired mentorship workspace data (owner decision). The feature was removed in 234;
-- no backend, job, script or frontend code reads or writes these tables any more.
--
-- Reviewed dependencies (migrations 207-209): the only foreign keys pointing AT these tables come
-- from other mentorship_* tables (milestones/actions/sessions -> goals, actions/feedback_requests -> sessions).
-- Their own FKs point to users(id); dropping them never touches users or any other table's rows.
-- No view, AI-usage, notification or payment table references them.
--
-- No CASCADE: tables are dropped children-first, and a guard aborts the migration if any object
-- outside the mentorship_* family depends on them (e.g. something created by hand in production),
-- instead of silently dropping it.
--
-- Also removes the retired flag row feature.mentor_services.enabled (it only gated this feature).
-- platform_feature_flag_audit history rows are kept (no FK; admin audit trail).
-- legacy_mentor_persona_backup (rollback source for 234's persona rewrite) is kept.
--
-- Idempotent: DROP ... IF EXISTS / DELETE ... WHERE.
-- Rollback (manual, schema only - the data cannot be restored):
--   backend/scripts/sql/rollback/235_drop_mentorship_tables.rollback.sql

SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
  deps TEXT;
BEGIN
  SELECT string_agg(DISTINCT format('%s (%s on %s)', dep.relname, d.deptype, ref.relname), ', ')
  INTO deps
  FROM pg_depend d
  JOIN pg_class ref ON ref.oid = d.refobjid
  JOIN pg_namespace rn ON rn.oid = ref.relnamespace AND rn.nspname = 'public'
  LEFT JOIN pg_rewrite rw ON d.classid = 'pg_rewrite'::regclass AND rw.oid = d.objid
  LEFT JOIN pg_constraint con ON d.classid = 'pg_constraint'::regclass AND con.oid = d.objid
  JOIN pg_class dep ON dep.oid = COALESCE(rw.ev_class, con.conrelid)
  WHERE ref.relname LIKE 'mentorship\_%'
    AND dep.relname NOT LIKE 'mentorship\_%'
    AND (rw.oid IS NOT NULL OR con.contype = 'f');
  IF deps IS NOT NULL THEN
    RAISE EXCEPTION 'migration 235: objects outside mentorship_* depend on the mentorship tables: %', deps;
  END IF;
END $$;

DROP TABLE IF EXISTS mentorship_feedback_requests;
DROP TABLE IF EXISTS mentorship_actions;
DROP TABLE IF EXISTS mentorship_milestones;
DROP TABLE IF EXISTS mentorship_sessions;
DROP TABLE IF EXISTS mentorship_goals;
DROP TABLE IF EXISTS mentorship_services;
DROP TABLE IF EXISTS mentorship_resources;
DROP TABLE IF EXISTS mentorship_agreements;

DO $$
BEGIN
  IF to_regclass('public.platform_feature_flags') IS NOT NULL THEN
    DELETE FROM platform_feature_flags WHERE key = 'feature.mentor_services.enabled';
  END IF;
END $$;
