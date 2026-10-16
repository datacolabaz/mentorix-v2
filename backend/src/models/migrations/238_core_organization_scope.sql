-- Core: organization boundary on the core teaching tables.
-- organization_id NULL = the teacher's personal workspace (every existing row today).
-- created_by: bank_questions / question_bank_topics already have it; on the other tables the owner column is
-- instructor_id and is read as created_by by the access layer (no duplicated column).
-- Additive: nullable columns (metadata-only), FKs added NOT VALID then validated, indexes. The only data
-- change is the instructor_groups backfill described below.
-- Rollback (manual): backend/scripts/sql/rollback/238_core_organization_scope.rollback.sql

SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'instructor_subjects', 'instructor_groups', 'question_bank_topics', 'bank_questions',
    'exams', 'course_materials', 'assignments'
  ] LOOP
    IF to_regclass(t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS organization_id UUID', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = t || '_organization_id_fkey' AND conrelid = to_regclass(t)
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (organization_id) REFERENCES courses(id) ON DELETE SET NULL NOT VALID',
        t, t || '_organization_id_fkey'
      );
      EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', t, t || '_organization_id_fkey');
    END IF;
  END LOOP;
END $$;

-- (organization_id, created_by) lookups. Partial: personal rows keep using the existing owner indexes.
CREATE INDEX IF NOT EXISTS idx_instructor_subjects_org_owner
  ON instructor_subjects (organization_id, instructor_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_instructor_groups_org_owner
  ON instructor_groups (organization_id, instructor_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_question_bank_topics_org_owner
  ON question_bank_topics (organization_id, created_by) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_questions_org_owner
  ON bank_questions (organization_id, created_by) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exams_org_owner
  ON exams (organization_id, instructor_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_course_materials_org_owner
  ON course_materials (organization_id, instructor_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assignments_org_owner
  ON assignments (organization_id, instructor_id) WHERE organization_id IS NOT NULL;

-- Backfill (groups only): a teacher who is an instructor of exactly ONE organization gets that organization
-- on their groups. Teachers in several organizations (or none) are left personal. Never overwrites a value.
-- Sources: org_memberships (role 'instructor') and active course_teachers of organization courses.
WITH teacher_orgs AS (
  SELECT m.user_id, m.course_id
  FROM org_memberships m
  JOIN courses c ON c.id = m.course_id AND COALESCE(c.is_organization, FALSE) = TRUE
  WHERE m.role_key = 'instructor'
  UNION
  SELECT ct.instructor_user_id, ct.course_id
  FROM course_teachers ct
  JOIN courses c ON c.id = ct.course_id AND COALESCE(c.is_organization, FALSE) = TRUE
  WHERE ct.is_active = TRUE
),
single_org AS (
  SELECT user_id, MIN(course_id::text)::uuid AS organization_id
  FROM teacher_orgs
  GROUP BY user_id
  HAVING COUNT(DISTINCT course_id) = 1
)
UPDATE instructor_groups g
SET organization_id = s.organization_id
FROM single_org s
WHERE g.instructor_id = s.user_id
  AND g.organization_id IS NULL;
