-- Create lessons table (generated dated lessons) and backfill from enrollment_lessons
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_date TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','absent','cancelled')),
  lesson_number INTEGER NOT NULL,
  billing_cycle INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT lessons_unique_enrollment_cycle_number UNIQUE (enrollment_id, billing_cycle, lesson_number),
  CONSTRAINT lessons_unique_instructor_time UNIQUE (instructor_id, lesson_date)
);

CREATE INDEX IF NOT EXISTS idx_lessons_student ON lessons (student_id);
CREATE INDEX IF NOT EXISTS idx_lessons_instructor ON lessons (instructor_id);
CREATE INDEX IF NOT EXISTS idx_lessons_lesson_date ON lessons (lesson_date);
CREATE INDEX IF NOT EXISTS idx_lessons_enrollment ON lessons (enrollment_id);

-- Backfill from existing enrollment_lessons (treat planned as pending)
INSERT INTO lessons (enrollment_id, student_id, instructor_id, lesson_date, status, lesson_number, billing_cycle, created_at)
SELECT el.enrollment_id,
       e.student_id,
       e.instructor_id,
       el.starts_at::timestamptz AS lesson_date,
       CASE
         WHEN el.status = 'done' THEN 'done'
         WHEN el.status = 'absent' THEN 'absent'
         ELSE 'pending'
       END AS status,
       el.lesson_number,
       el.billing_cycle,
       el.created_at
FROM enrollment_lessons el
JOIN enrollments e ON e.id = el.enrollment_id
ON CONFLICT (enrollment_id, billing_cycle, lesson_number) DO NOTHING;

