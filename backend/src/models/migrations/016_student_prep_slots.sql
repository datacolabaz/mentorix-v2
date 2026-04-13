CREATE TABLE IF NOT EXISTS student_prep_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT student_prep_slots_time_order CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_student_prep_slots_student ON student_prep_slots (student_id);
CREATE INDEX IF NOT EXISTS idx_student_prep_slots_student_day ON student_prep_slots (student_id, day_of_week);

