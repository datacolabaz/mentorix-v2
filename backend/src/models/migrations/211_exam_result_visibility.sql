-- İmtahan nəticələrinin tələbəyə göstərilmə rejimi.
-- NULL = köhnə qayda (show_results sütununa baxılır), mövcud imtahanların davranışı dəyişmir.

ALTER TABLE exams ADD COLUMN IF NOT EXISTS result_visibility_mode TEXT;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS results_release_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exams_result_visibility_mode_check'
  ) THEN
    ALTER TABLE exams ADD CONSTRAINT exams_result_visibility_mode_check CHECK (
      result_visibility_mode IS NULL OR result_visibility_mode IN (
        'immediate_full_review',
        'after_exam_window',
        'after_manual_grading',
        'score_only',
        'wrong_answers_only'
      )
    );
  END IF;
END $$;

-- show_results = TRUE (və ya NULL) imtahanlar indiyədək dərhal tam nəticə göstərirdi → eyni davranış.
-- show_results = FALSE imtahanlar NULL qalır: tələbə öz cavablarını və düzgün/səhv statusunu görür,
-- düzgün açar gizlidir. Bu davranışı yeni rejimlərin heç biri dəqiq təkrarlamır.
UPDATE exams
SET result_visibility_mode = 'immediate_full_review'
WHERE result_visibility_mode IS NULL
  AND COALESCE(show_results, TRUE) = TRUE;

COMMENT ON COLUMN exams.result_visibility_mode IS
  'Nəticə rejimi. NULL = köhnə qayda (show_results=false: cavablar görünür, düzgün açar gizli)';
COMMENT ON COLUMN exams.results_release_at IS
  'after_exam_window üçün buraxılış vaxtı; boşdursa available_until istifadə olunur';
