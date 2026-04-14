-- Store per-question auto-grading outcome (e.g. matching correct/incorrect) on submit.
ALTER TABLE exam_results
  ADD COLUMN IF NOT EXISTS grading JSONB;

