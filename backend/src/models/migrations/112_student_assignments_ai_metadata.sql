-- AI köməkçi rəy: hər tələbə təslimi üçün metadata

ALTER TABLE student_assignments
  ADD COLUMN IF NOT EXISTS ai_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_student_assignments_ai_pending
  ON student_assignments ((ai_metadata->>'status'))
  WHERE (ai_metadata->>'status') = 'pending';
