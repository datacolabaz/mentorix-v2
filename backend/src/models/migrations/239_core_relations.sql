-- Core relations on top of the existing tables (no new link tables):
--   user–organization : org_memberships (role_key)                         — unchanged
--   user–group        : instructor_group_members + enrollments.group_id    — unified read view below
--   group–subject     : instructor_groups.subject_id                       — + organization consistency
--   topic–subject     : question_bank_topics.subject_id + parent_topic_id  — + depth / cycle / organization guard
-- Rollback (manual): backend/scripts/sql/rollback/239_core_relations.rollback.sql

SET LOCAL lock_timeout = '10s';

-- user–group, read-only. 'member' rows come from instructor_group_members (participant groups),
-- 'enrollment' rows from the student's current enrollment in the group.
CREATE OR REPLACE VIEW group_memberships_v AS
SELECT igm.group_id,
       igm.student_id AS user_id,
       g.instructor_id AS created_by,
       g.organization_id,
       'member'::text AS source,
       'active'::text AS status,
       igm.joined_at
FROM instructor_group_members igm
JOIN instructor_groups g ON g.id = igm.group_id
UNION ALL
SELECT e.group_id,
       e.student_id AS user_id,
       g.instructor_id AS created_by,
       g.organization_id,
       'enrollment'::text AS source,
       COALESCE(LOWER(TRIM(e.status)), 'active') AS status,
       e.enrolled_at AS joined_at
FROM enrollments e
JOIN instructor_groups g ON g.id = e.group_id
WHERE e.group_id IS NOT NULL
  AND e.deleted_at IS NULL
  AND COALESCE(LOWER(TRIM(e.status)), 'active') NOT IN ('rejected', 'left', 'archived');

COMMENT ON VIEW group_memberships_v IS
  'user–group relation (read-only): participant-group members + current enrollments. Writes stay on the source tables.';

-- topic–subject: max depth 5 (root = 1), no cycles, parent in the same organization as the child.
CREATE OR REPLACE FUNCTION core_topic_tree_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cur UUID := NEW.parent_topic_id;
  depth INT := 1;
  parent_org UUID;
BEGIN
  IF NEW.parent_topic_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT organization_id INTO parent_org FROM question_bank_topics WHERE id = NEW.parent_topic_id;
  IF parent_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'topic parent belongs to another organization' USING ERRCODE = 'check_violation';
  END IF;
  WHILE cur IS NOT NULL LOOP
    IF cur = NEW.id THEN
      RAISE EXCEPTION 'topic tree cycle' USING ERRCODE = 'check_violation';
    END IF;
    depth := depth + 1;
    IF depth > 5 THEN
      RAISE EXCEPTION 'topic tree deeper than 5 levels' USING ERRCODE = 'check_violation';
    END IF;
    SELECT parent_topic_id INTO cur FROM question_bank_topics WHERE id = cur;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS core_topic_tree_guard ON question_bank_topics;
CREATE TRIGGER core_topic_tree_guard
  BEFORE INSERT OR UPDATE OF parent_topic_id, organization_id ON question_bank_topics
  FOR EACH ROW EXECUTE FUNCTION core_topic_tree_guard();

-- group–subject: an organization group may use a personal subject of its teacher or a subject of the
-- same organization, never a subject of another organization.
CREATE OR REPLACE FUNCTION core_group_subject_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  subject_org UUID;
BEGIN
  IF NEW.subject_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT organization_id INTO subject_org FROM instructor_subjects WHERE id = NEW.subject_id;
  IF subject_org IS NOT NULL AND subject_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'group subject belongs to another organization' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS core_group_subject_guard ON instructor_groups;
CREATE TRIGGER core_group_subject_guard
  BEFORE INSERT OR UPDATE OF subject_id, organization_id ON instructor_groups
  FOR EACH ROW EXECUTE FUNCTION core_group_subject_guard();
