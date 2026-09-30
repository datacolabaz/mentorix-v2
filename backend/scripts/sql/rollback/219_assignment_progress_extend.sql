-- MANUAL rollback for 219_assignment_progress_extend.sql. Never place this file in src/models/migrations.
-- Run only after the Phase C code is reverted.
-- Assignments currently returned for revision go back to 'pending' (their submitted_at is already NULL),
-- so the student can still submit with the old code. The return history (returned_at) is lost.
BEGIN;

UPDATE student_assignments SET status = 'pending' WHERE status = 'returned';

ALTER TABLE student_assignments DROP CONSTRAINT IF EXISTS student_assignments_status_check;
ALTER TABLE student_assignments ADD CONSTRAINT student_assignments_status_check
  CHECK (status IN ('pending', 'submitted', 'reviewed', 'late', 'late_rejected'));

ALTER TABLE student_assignments
  DROP COLUMN IF EXISTS returned_at,
  DROP COLUMN IF EXISTS first_submitted_at,
  DROP COLUMN IF EXISTS submission_count;

DROP INDEX IF EXISTS idx_assignment_status_assignment_status;
ALTER TABLE assignment_status DROP CONSTRAINT IF EXISTS assignment_status_status_check;
ALTER TABLE assignment_status
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS submitted_at,
  DROP COLUMN IF EXISTS graded_at,
  DROP COLUMN IF EXISTS returned_at,
  DROP COLUMN IF EXISTS overdue_at,
  DROP COLUMN IF EXISTS submission_count,
  DROP COLUMN IF EXISTS is_late,
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS updated_at;

DELETE FROM schema_migrations WHERE filename = '219_assignment_progress_extend.sql';

COMMIT;
