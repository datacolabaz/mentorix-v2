-- Kurs idarəetməsi: Course → Teachers → Groups → Students
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_teachers (
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  instructor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  title VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (course_id, instructor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_course_teachers_instructor_active
  ON course_teachers (instructor_user_id) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS course_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  instructor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  instructor_group_id UUID REFERENCES instructor_groups(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, instructor_group_id)
);

CREATE INDEX IF NOT EXISTS idx_course_groups_course ON course_groups (course_id) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS course_group_members (
  group_id UUID NOT NULL REFERENCES course_groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_course_group_members_student ON course_group_members (student_id);

-- Mövcud kurs sahibləri üçün courses + owner müəllim əlaqəsi
INSERT INTO courses (owner_user_id, name)
SELECT cp.user_id, COALESCE(NULLIF(TRIM(cp.course_name), ''), u.full_name, 'Kursum')
FROM course_profiles cp
INNER JOIN users u ON u.id = cp.user_id
WHERE COALESCE(u.is_active, TRUE) = TRUE
ON CONFLICT (owner_user_id) DO UPDATE SET
  name = COALESCE(EXCLUDED.name, courses.name),
  updated_at = NOW();

INSERT INTO course_teachers (course_id, instructor_user_id, is_active)
SELECT c.id, c.owner_user_id, TRUE
FROM courses c
INNER JOIN instructor_profiles ip ON ip.user_id = c.owner_user_id
ON CONFLICT (course_id, instructor_user_id) DO UPDATE SET is_active = TRUE;

-- Müəllim qrupları → kurs qrupları
INSERT INTO course_groups (course_id, instructor_user_id, instructor_group_id, name, sort_order)
SELECT c.id, ig.instructor_id, ig.id, ig.name, COALESCE(ig.sort_order, 0)
FROM instructor_groups ig
INNER JOIN course_teachers ct ON ct.instructor_user_id = ig.instructor_id AND ct.is_active = TRUE
INNER JOIN courses c ON c.id = ct.course_id
ON CONFLICT (course_id, instructor_group_id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- Enrollment qrup üzvləri
INSERT INTO course_group_members (group_id, student_id, enrollment_id)
SELECT cg.id, e.student_id, e.id
FROM enrollments e
INNER JOIN course_groups cg ON cg.instructor_group_id = e.group_id
INNER JOIN users u ON u.id = e.student_id
WHERE COALESCE(u.is_active, TRUE) = TRUE
  AND COALESCE(LOWER(TRIM(e.status)), 'active') = 'active'
  AND e.group_id IS NOT NULL
ON CONFLICT (group_id, student_id) DO UPDATE SET enrollment_id = EXCLUDED.enrollment_id;

COMMENT ON TABLE courses IS 'Tədris mərkəzi / kurs təşkilatı (panel sahibi)';
COMMENT ON TABLE course_teachers IS 'Kursa bağlı müəllimlər';
COMMENT ON TABLE course_groups IS 'Kurs qrupları (müəllim qrupu ilə əlaqəli ola bilər)';
COMMENT ON TABLE course_group_members IS 'Qrup üzvləri (tələbələr)';
