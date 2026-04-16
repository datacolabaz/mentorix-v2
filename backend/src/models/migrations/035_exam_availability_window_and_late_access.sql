-- Exams: availability window + per-student late access override

ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS available_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS available_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS allow_finish_after_until BOOLEAN DEFAULT TRUE;

-- Backfill for legacy exams:
-- available_from := start_time, available_until := start_time + duration_minutes
UPDATE exams
SET available_from = COALESCE(available_from, start_time),
    available_until = COALESCE(
      available_until,
      CASE
        WHEN start_time IS NULL THEN NULL
        ELSE start_time + (COALESCE(duration_minutes, 0) || ' minutes')::interval
      END
    )
WHERE available_from IS NULL OR available_until IS NULL;

ALTER TABLE exam_assignments
  ADD COLUMN IF NOT EXISTS late_access_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_exams_available_from ON exams (available_from);
CREATE INDEX IF NOT EXISTS idx_exams_available_until ON exams (available_until);
CREATE INDEX IF NOT EXISTS idx_exam_assignments_late_access_until ON exam_assignments (late_access_until);

