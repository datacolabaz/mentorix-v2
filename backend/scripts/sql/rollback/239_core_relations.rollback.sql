-- MANUAL rollback for migration 239_core_relations.sql. Not read by scripts/migrate.js.
-- No data loss: drops a read-only view and two guard triggers. Roll back 239 before 238.
--
-- Usage (non-production first):  psql "$DATABASE_URL" -f backend/scripts/sql/rollback/239_core_relations.rollback.sql

BEGIN;

SET LOCAL lock_timeout = '10s';

DROP TRIGGER IF EXISTS core_group_subject_guard ON instructor_groups;
DROP FUNCTION IF EXISTS core_group_subject_guard();
DROP TRIGGER IF EXISTS core_topic_tree_guard ON question_bank_topics;
DROP FUNCTION IF EXISTS core_topic_tree_guard();
DROP VIEW IF EXISTS group_memberships_v;

DELETE FROM schema_migrations WHERE filename = '239_core_relations.sql';

COMMIT;
