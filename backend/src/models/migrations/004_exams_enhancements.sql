-- İmtahan modulu: topic, notify_students, exam_files, notification_jobs, sual tipləri

ALTER TABLE exams ADD COLUMN IF NOT EXISTS topic VARCHAR(255);
ALTER TABLE exams ADD COLUMN IF NOT EXISTS notify_students BOOLEAN DEFAULT FALSE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS exam_files JSONB DEFAULT '[]'::jsonb;

UPDATE exams SET notify_students = TRUE WHERE notify_enabled = TRUE AND notify_students IS NOT TRUE;

ALTER TABLE exam_questions DROP CONSTRAINT IF EXISTS exam_questions_question_type_check;
ALTER TABLE exam_questions ADD CONSTRAINT exam_questions_question_type_check
  CHECK (question_type IN ('closed', 'open', 'matching', 'multiple'));

CREATE TABLE IF NOT EXISTS notification_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  job_type VARCHAR(50) NOT NULL,
  run_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_jobs_pending ON notification_jobs (run_at) WHERE processed_at IS NULL;
