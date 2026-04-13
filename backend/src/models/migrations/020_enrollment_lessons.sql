ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS lesson_times JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS enrollment_lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  billing_cycle INTEGER NOT NULL DEFAULT 1,
  lesson_number INTEGER NOT NULL,
  starts_at TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','done','absent')),
  marked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT enrollment_lessons_unique UNIQUE (enrollment_id, billing_cycle, lesson_number)
);

CREATE INDEX IF NOT EXISTS idx_enrollment_lessons_enrollment ON enrollment_lessons (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_lessons_starts_at ON enrollment_lessons (starts_at);

