-- Kurs CRM: lidlər + fərdi müəllim datasından izolyasiya (org kurs scope)
CREATE TABLE IF NOT EXISTS course_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(64),
  source VARCHAR(50) NOT NULL DEFAULT 'manual',
  status VARCHAR(32) NOT NULL DEFAULT 'new',
  notes TEXT,
  trial_lesson_at TIMESTAMPTZ,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  converted_student_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('new', 'contacted', 'trial_scheduled', 'trial_done', 'thinking', 'won', 'lost'))
);

CREATE INDEX IF NOT EXISTS idx_course_leads_course_status ON course_leads (course_id, status);
CREATE INDEX IF NOT EXISTS idx_course_leads_course_phone ON course_leads (course_id, phone);

-- Org kurs paneli: avtomatik köçürülmüş şəxsi tələbə/müəllim əlaqələrini təmizlə (manual transfer sonra)
DELETE FROM course_students cs
USING courses c
WHERE cs.course_id = c.id AND COALESCE(c.is_organization, FALSE) = TRUE;

UPDATE enrollments e
SET course_id = NULL
FROM courses c
WHERE e.course_id = c.id AND COALESCE(c.is_organization, FALSE) = TRUE;

DELETE FROM course_teachers ct
USING courses c
WHERE ct.course_id = c.id
  AND COALESCE(c.is_organization, FALSE) = TRUE
  AND ct.instructor_user_id = c.owner_user_id;

COMMENT ON TABLE course_leads IS 'Kurs CRM: qəbul öncəsi maraqlananlar (course_id izolyasiyası)';
