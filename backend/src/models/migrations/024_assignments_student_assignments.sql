-- Tapşırıqlar: instructor_tasks → assignments, task_assignments → student_assignments
-- Status: assigned/done → pending/completed; topic sütunu; FK ilə silinmə saxlanılır

ALTER TABLE instructor_tasks ADD COLUMN IF NOT EXISTS topic TEXT;

ALTER TABLE instructor_tasks RENAME TO assignments;

ALTER INDEX idx_instructor_tasks_instructor RENAME TO idx_assignments_instructor;

ALTER TABLE task_assignments RENAME TO student_assignments;

ALTER TABLE student_assignments RENAME COLUMN task_id TO assignment_id;

ALTER INDEX idx_task_assignments_student RENAME TO idx_student_assignments_student;
ALTER INDEX idx_task_assignments_task RENAME TO idx_student_assignments_assignment;

ALTER TABLE student_assignments DROP CONSTRAINT IF EXISTS task_assignments_status_check;

UPDATE student_assignments SET status = 'pending' WHERE status = 'assigned';
UPDATE student_assignments SET status = 'completed' WHERE status = 'done';

ALTER TABLE student_assignments
  ADD CONSTRAINT student_assignments_status_check
  CHECK (status IN ('pending', 'completed'));

ALTER TABLE student_assignments ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE student_assignments DROP CONSTRAINT IF EXISTS task_assignments_task_id_fkey;
ALTER TABLE student_assignments
  ADD CONSTRAINT student_assignments_assignment_id_fkey
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE;

ALTER TABLE student_assignments DROP CONSTRAINT IF EXISTS task_assignments_student_id_fkey;
ALTER TABLE student_assignments
  ADD CONSTRAINT student_assignments_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE student_assignments DROP CONSTRAINT IF EXISTS task_assignments_unique;
ALTER TABLE student_assignments
  ADD CONSTRAINT student_assignments_unique UNIQUE (assignment_id, student_id);
