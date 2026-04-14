-- Soft delete exams (hide from student lists without losing history)
ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_exams_is_deleted ON exams (is_deleted);

