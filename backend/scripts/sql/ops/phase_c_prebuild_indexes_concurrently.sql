-- OPTIONAL, MANUAL, run BEFORE deploying Phase C to a database where exam_results / student_activity_log are large.
-- Never place this file in src/models/migrations: scripts/migrate.js wraps every migration in BEGIN/COMMIT and
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block (the boot would fail).
--
-- Why: migrations 217/219/220 build these indexes with plain CREATE INDEX inside the runner's transaction, which
-- blocks writes to the table for the whole build (217 additionally holds ACCESS EXCLUSIVE from its ALTER TABLE, so
-- reads of student_activity_log wait too). Pre-building them CONCURRENTLY (no write block) makes the migrations'
-- CREATE INDEX IF NOT EXISTS a catalog no-op. The definitions below must stay identical to the migrations
-- (enforced by activityStatusRules.test.js), because IF NOT EXISTS only compares the index NAME.
--
-- How (psql, autocommit; do NOT wrap in BEGIN):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/scripts/sql/ops/phase_c_prebuild_indexes_concurrently.sql
-- 1) Size check first (read-only):
--   SELECT relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid)) AS total
--     FROM pg_stat_user_tables
--    WHERE relname IN ('exam_results', 'student_activity_log', 'assignment_status') ORDER BY relname;
-- 2) After running, every index must be valid. A failed CONCURRENTLY build leaves an INVALID index with the same
--    name, and IF NOT EXISTS would then silently skip it. Check:
--   SELECT c.relname, i.indisvalid FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
--    WHERE c.relname IN ('idx_exam_results_exam_student', 'idx_exam_results_open_attempts',
--      'idx_student_activity_log_instructor', 'idx_student_activity_log_event');
--    For any row with indisvalid = false: DROP INDEX CONCURRENTLY <name>; then re-run this file.
--
-- Not included: uq_student_activity_log_dedupe / idx_student_activity_log_group (need 217's new columns) and
-- idx_assignment_status_assignment_status (needs 219's status column). Those are built by the migrations on boot.
SET lock_timeout = '5s';

-- 220: exam_results (no column dependency: safe before the first Phase C deploy)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exam_results_exam_student ON exam_results (exam_id, student_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exam_results_open_attempts
  ON exam_results (started_at)
  WHERE submitted_at IS NULL AND status = 'in_progress';

-- 217: student_activity_log (instructor/event indexes use pre-existing columns)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_activity_log_instructor
  ON student_activity_log (instructor_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_activity_log_event
  ON student_activity_log (event_type, created_at DESC);
