-- Ensure dependent exam rows are removed when an exam is hard-deleted.
-- Constraint names use Postgres defaults; IF EXISTS keeps it safe across environments.

ALTER TABLE exam_questions
  DROP CONSTRAINT IF EXISTS exam_questions_exam_id_fkey;
ALTER TABLE exam_questions
  ADD CONSTRAINT exam_questions_exam_id_fkey
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;

ALTER TABLE exam_results
  DROP CONSTRAINT IF EXISTS exam_results_exam_id_fkey;
ALTER TABLE exam_results
  ADD CONSTRAINT exam_results_exam_id_fkey
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;

ALTER TABLE exam_assignments
  DROP CONSTRAINT IF EXISTS exam_assignments_exam_id_fkey;
ALTER TABLE exam_assignments
  ADD CONSTRAINT exam_assignments_exam_id_fkey
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;

