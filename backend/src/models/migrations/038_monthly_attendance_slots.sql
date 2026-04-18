-- Aylıq paket: dərs günləri üzrə davamiyyət (pending / attended / absent / archived)

CREATE TABLE IF NOT EXISTS monthly_attendance_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  lesson_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'attended', 'absent', 'archived')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT monthly_att_slots_enrollment_lesson_date UNIQUE (enrollment_id, lesson_date)
);

CREATE INDEX IF NOT EXISTS idx_monthly_att_slots_enrollment ON monthly_attendance_slots (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_monthly_att_slots_lesson_date ON monthly_attendance_slots (lesson_date);
