-- Phase C: tapşırıq irəliləyişi. Mənbə qalır: student_assignments (təqdim/qiymət) + assignment_status (açılma/başlama).
-- assignment_status = assignment_student_progress (PK (assignment_id, student_id) — tələbə başına bir sətir).
-- Yeni status: student_assignments.status = 'returned' (müəllim yenidən işləməyə qaytardı).
-- Rollback: backend/scripts/sql/rollback/219_assignment_progress_extend.sql (əl ilə).

ALTER TABLE student_assignments
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submission_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE student_assignments DROP CONSTRAINT IF EXISTS student_assignments_status_check;
ALTER TABLE student_assignments ADD CONSTRAINT student_assignments_status_check
  CHECK (status IN ('pending', 'submitted', 'reviewed', 'late', 'late_rejected', 'returned')) NOT VALID;

ALTER TABLE assignment_status
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS overdue_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submission_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_late BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE assignment_status DROP CONSTRAINT IF EXISTS assignment_status_status_check;
ALTER TABLE assignment_status ADD CONSTRAINT assignment_status_status_check CHECK (status IS NULL OR status IN (
  'not_opened', 'viewed', 'in_progress', 'submitted', 'late_submitted', 'graded', 'returned_for_revision', 'overdue'
)) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_assignment_status_assignment_status
  ON assignment_status (assignment_id, status);
