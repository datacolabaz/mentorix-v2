-- MANUAL rollback for 224_dashboard_summary_indexes.sql. Never place this file in src/models/migrations.
-- Safe while the Phase E code is live: the student dashboard keeps working, it only scans exam_assignments again.
BEGIN;

DROP INDEX IF EXISTS idx_exam_assignments_student;

DELETE FROM schema_migrations WHERE filename = '224_dashboard_summary_indexes.sql';

COMMIT;
