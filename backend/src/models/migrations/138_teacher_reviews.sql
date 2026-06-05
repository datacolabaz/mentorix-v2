-- Müəllim rəyləri: yalnız təsdiqlənmiş CRM tələbələr (backend yoxlaması ilə)
CREATE TABLE IF NOT EXISTS teacher_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (instructor_user_id, student_user_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_reviews_instructor_created
  ON teacher_reviews (instructor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_teacher_reviews_student
  ON teacher_reviews (student_user_id);
