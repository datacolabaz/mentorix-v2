-- Tələbə imtahan linki ilə gələndə təyinat yoxdursa müəllimə sorğu
CREATE TABLE IF NOT EXISTS exam_access_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (UPPER(TRIM(status)) IN ('PENDING', 'APPROVED', 'REJECTED')),
  student_email TEXT,
  student_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_exam_access_requests_exam_student_pending
  ON exam_access_requests (exam_id, student_id)
  WHERE UPPER(TRIM(status)) = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_exam_access_requests_instructor_pending
  ON exam_access_requests (instructor_id, created_at DESC)
  WHERE UPPER(TRIM(status)) = 'PENDING';
