-- Billing cycles: allow 8/12 lesson packages to repeat per enrollment

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS billing_cycle INTEGER NOT NULL DEFAULT 1;

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS billing_cycle INTEGER NOT NULL DEFAULT 1;

-- Prevent duplicate lesson numbers within the same cycle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_unique_cycle_lesson'
  ) THEN
    ALTER TABLE attendance
      ADD CONSTRAINT attendance_unique_cycle_lesson UNIQUE (enrollment_id, billing_cycle, lesson_number);
  END IF;
END $$;

