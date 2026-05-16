-- Kurs = mərkəzi vahid (müəllim → çoxlu kurs → çoxlu tələbə)
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_owner_user_id_key;

ALTER TABLE courses ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS lesson_weekdays JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS lesson_times JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(10, 2);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_organization BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE courses
SET instructor_id = owner_user_id,
    is_organization = TRUE
WHERE instructor_id IS NULL AND owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_courses_instructor ON courses (instructor_id) WHERE instructor_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS course_students (
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (course_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_course_students_student ON course_students (student_id);

ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments (course_id) WHERE course_id IS NOT NULL;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_payments_course_id ON payments (course_id) WHERE course_id IS NOT NULL;

-- Hər müəllim üçün ən azı bir tədris kursu + mövcud enrollment-ları bağla
INSERT INTO courses (name, instructor_id, owner_user_id, lesson_weekdays, lesson_times, monthly_fee, is_organization)
SELECT DISTINCT ON (e.instructor_id)
  'Ümumi kurs',
  e.instructor_id,
  e.instructor_id,
  COALESCE(e.lesson_weekdays, '[]'::jsonb),
  COALESCE(e.lesson_times, '{}'::jsonb),
  sp.monthly_fee,
  FALSE
FROM enrollments e
INNER JOIN users u ON u.id = e.student_id
LEFT JOIN student_profiles sp ON sp.user_id = e.student_id
WHERE COALESCE(LOWER(TRIM(e.status)), 'active') = 'active'
  AND e.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM courses c
    WHERE c.instructor_id = e.instructor_id AND COALESCE(c.is_organization, FALSE) = FALSE
  )
ORDER BY e.instructor_id, e.enrolled_at DESC NULLS LAST;

UPDATE enrollments e
SET course_id = c.id
FROM courses c
WHERE c.instructor_id = e.instructor_id
  AND COALESCE(c.is_organization, FALSE) = FALSE
  AND e.course_id IS NULL
  AND e.deleted_at IS NULL;

INSERT INTO course_students (course_id, student_id, enrollment_id)
SELECT e.course_id, e.student_id, e.id
FROM enrollments e
WHERE e.course_id IS NOT NULL
  AND e.deleted_at IS NULL
ON CONFLICT (course_id, student_id) DO UPDATE SET enrollment_id = EXCLUDED.enrollment_id;

UPDATE payments p
SET course_id = e.course_id
FROM enrollments e
WHERE p.enrollment_id = e.id
  AND e.course_id IS NOT NULL
  AND p.course_id IS NULL;
