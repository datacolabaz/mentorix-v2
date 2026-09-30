-- Phase C: assessment_student_progress (imtahan × tələbə üzrə bir sətir).
-- exam_results cəhdləri saxlamağa davam edir; bu cədvəl kart/hesabat üçün aqreqatdır.
-- exam_results.status yeni dəyərlər alır (CHECK yoxdur, VARCHAR(20)): 'expired' (cavabsız vaxtı bitib), 'voided' (ləğv edilmiş cəhd).
-- Rollback: backend/scripts/sql/rollback/220_exam_student_progress.sql (əl ilə).

CREATE TABLE IF NOT EXISTS exam_student_progress (
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (
    'not_started', 'viewed', 'in_progress', 'completed',
    'expired_auto_submitted', 'expired_no_answers', 'pending_manual_grading', 'result_released'
  )),
  current_result_id UUID REFERENCES exam_results(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  result_released_at TIMESTAMPTZ,
  latest_activity_at TIMESTAMPTZ,
  answered_question_count INTEGER NOT NULL DEFAULT 0,
  total_question_count INTEGER,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  active_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (exam_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_progress_student ON exam_student_progress (student_id);
CREATE INDEX IF NOT EXISTS idx_exam_progress_exam_status ON exam_student_progress (exam_id, status);
CREATE INDEX IF NOT EXISTS idx_exam_progress_exam_activity ON exam_student_progress (exam_id, latest_activity_at DESC);

-- exam_results: tələbənin son cəhdini tapmaq (unikal deyil — köhnə dublikatlar ola bilər)
CREATE INDEX IF NOT EXISTS idx_exam_results_exam_student ON exam_results (exam_id, student_id);
-- Vaxtı bitmiş açıq cəhdləri tapan dəqiqəlik iş üçün kiçik qismən indeks
CREATE INDEX IF NOT EXISTS idx_exam_results_open_attempts
  ON exam_results (started_at)
  WHERE submitted_at IS NULL AND status = 'in_progress';
