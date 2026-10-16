-- MANUAL rollback for migration 238_core_organization_scope.sql.
-- This folder is NOT read by scripts/migrate.js. Never copy this file into src/models/migrations/.
--
-- Run only after migration 239 has been rolled back and the application code that reads organization_id
-- has been rolled back. DATA LOSS WARNING: drops the organization assignment of subjects, groups, topics,
-- questions, exams, materials and assignments (the rows themselves stay). Export first if needed:
--   \copy (SELECT id, organization_id FROM instructor_groups WHERE organization_id IS NOT NULL) TO 'groups_org_238.csv' CSV HEADER
--
-- Usage (non-production first):  psql "$DATABASE_URL" -f backend/scripts/sql/rollback/238_core_organization_scope.rollback.sql

BEGIN;

SET LOCAL lock_timeout = '10s';

DROP INDEX IF EXISTS idx_instructor_subjects_org_owner;
DROP INDEX IF EXISTS idx_instructor_groups_org_owner;
DROP INDEX IF EXISTS idx_question_bank_topics_org_owner;
DROP INDEX IF EXISTS idx_bank_questions_org_owner;
DROP INDEX IF EXISTS idx_exams_org_owner;
DROP INDEX IF EXISTS idx_course_materials_org_owner;
DROP INDEX IF EXISTS idx_assignments_org_owner;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'instructor_subjects', 'instructor_groups', 'question_bank_topics', 'bank_questions',
    'exams', 'course_materials', 'assignments'
  ] LOOP
    IF to_regclass(t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS organization_id', t);
    END IF;
  END LOOP;
END $$;

DELETE FROM schema_migrations WHERE filename = '238_core_organization_scope.sql';

COMMIT;
