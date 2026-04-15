-- Deduplicate exam_assignments and enforce uniqueness (exam_id, student_id)
-- Needed for INSERT ... ON CONFLICT DO NOTHING in application code.

DELETE FROM exam_assignments a
USING exam_assignments b
WHERE a.exam_id = b.exam_id
  AND a.student_id = b.student_id
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_exam_assignments_exam_student
  ON exam_assignments (exam_id, student_id);
