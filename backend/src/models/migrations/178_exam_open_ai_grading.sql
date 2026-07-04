-- Açıq sual AI köməkli qiymətləndirmə: müəllim model cavabı + nəticə üzrə grading JSONB
ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS model_answer TEXT;

COMMENT ON COLUMN exam_questions.model_answer IS
  'Müəllimin nümunə/istinad cavabı — yalnız AI qiymətləndirməsi üçün; tələbəyə göstərilmir';

CREATE TABLE IF NOT EXISTS exam_open_grading_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_result_id UUID NOT NULL REFERENCES exam_results(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_exam_open_grading_queue_pending
  ON exam_open_grading_queue (created_at)
  WHERE processed_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_open_grading_queue_result
  ON exam_open_grading_queue (exam_result_id)
  WHERE processed_at IS NULL;
