-- Tapşırıq modulu: qrup, max bal, rəy, gecikmə, AI metadata

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS max_score INTEGER CHECK (max_score IS NULL OR max_score > 0),
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES instructor_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES instructor_subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_assignments_group ON assignments (group_id) WHERE group_id IS NOT NULL;

ALTER TABLE student_assignments
  ADD COLUMN IF NOT EXISTS score NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS feedback TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS late_decision VARCHAR(16),
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS overdue_notified_at TIMESTAMPTZ;

ALTER TABLE student_assignments DROP CONSTRAINT IF EXISTS student_assignments_status_check;

UPDATE student_assignments SET status = 'submitted' WHERE status = 'completed';

ALTER TABLE student_assignments
  ADD CONSTRAINT student_assignments_status_check
  CHECK (status IN ('pending', 'submitted', 'reviewed', 'late', 'late_rejected'));

ALTER TABLE student_assignments
  ADD CONSTRAINT student_assignments_late_decision_check
  CHECK (late_decision IS NULL OR late_decision IN ('accepted', 'rejected'));
