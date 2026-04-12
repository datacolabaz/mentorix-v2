-- Müəllim dərs cədvəli (həftəlik slotlar)
CREATE TABLE IF NOT EXISTS teacher_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_occupied BOOLEAN NOT NULL DEFAULT FALSE,
  enrollment_id UUID,
  student_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT teacher_schedules_time_order CHECK (start_time < end_time),
  CONSTRAINT teacher_schedules_unique_slot UNIQUE (instructor_id, day_of_week, start_time, end_time)
);

CREATE INDEX IF NOT EXISTS idx_teacher_schedules_instructor ON teacher_schedules (instructor_id);
CREATE INDEX IF NOT EXISTS idx_teacher_schedules_instructor_day ON teacher_schedules (instructor_id, day_of_week);

-- Ödəniş başlanğıc tarixi (tam tarix)
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS payment_start_date DATE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'student_profiles' AND column_name = 'payment_day'
  ) THEN
    UPDATE student_profiles
    SET payment_start_date = make_date(
      EXTRACT(YEAR FROM CURRENT_DATE)::int,
      EXTRACT(MONTH FROM CURRENT_DATE)::int,
      LEAST(
        GREATEST(COALESCE(payment_day, 1), 1),
        EXTRACT(DAY FROM (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day'))::int
      )
    )
    WHERE payment_start_date IS NULL AND payment_day IS NOT NULL;
  END IF;
END $$;

ALTER TABLE student_profiles DROP COLUMN IF EXISTS payment_day;
