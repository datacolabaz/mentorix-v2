-- Historical "lessons actually started" anchor for billing + UI (separate from enrolled_at system timestamp)

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS enrollment_start_date DATE;

-- Backfill: best-effort from existing student profile anchor (if any)
UPDATE enrollments e
SET enrollment_start_date = sp.payment_start_date::date
FROM student_profiles sp
WHERE sp.user_id = e.student_id
  AND e.enrollment_start_date IS NULL
  AND sp.payment_start_date IS NOT NULL;
