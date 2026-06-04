-- Unikal tələbə–müəllim əlaqəsi (limit sayğacı və audit)

BEGIN;

CREATE TABLE IF NOT EXISTS instructor_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verified_phone VARCHAR(20),
  device_fingerprint VARCHAR(128),
  ip_address VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (instructor_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_instructor_students_instructor
  ON instructor_students (instructor_id);

CREATE INDEX IF NOT EXISTS idx_instructor_students_student
  ON instructor_students (student_id);

-- Köhnə qoşulmalar (aktiv / gözləyən qeydiyyatlar)
INSERT INTO instructor_students (instructor_id, student_id, verified_phone, created_at)
SELECT DISTINCT
  e.instructor_id,
  e.student_id,
  COALESCE(NULLIF(TRIM(sp.phone_number), ''), NULLIF(TRIM(u.phone), '')),
  COALESCE(e.enrolled_at, NOW())
FROM enrollments e
JOIN users u ON u.id = e.student_id AND u.role = 'student'
LEFT JOIN student_profiles sp ON sp.user_id = u.id
WHERE e.deleted_at IS NULL
  AND COALESCE(LOWER(TRIM(e.status)), '') NOT IN ('rejected', 'left', 'archived')
ON CONFLICT (instructor_id, student_id) DO NOTHING;

-- İmtahan təyinatları
INSERT INTO instructor_students (instructor_id, student_id, verified_phone, created_at)
SELECT DISTINCT
  ex.instructor_id,
  ea.student_id,
  COALESCE(NULLIF(TRIM(sp.phone_number), ''), NULLIF(TRIM(u.phone), '')),
  NOW()
FROM exam_assignments ea
JOIN exams ex ON ex.id = ea.exam_id AND COALESCE(ex.is_deleted, FALSE) = FALSE
JOIN users u ON u.id = ea.student_id AND u.role = 'student'
LEFT JOIN student_profiles sp ON sp.user_id = u.id
ON CONFLICT (instructor_id, student_id) DO NOTHING;

-- Gözləyən imtahan sorğuları (link ilə qoşulma cəhdi)
INSERT INTO instructor_students (instructor_id, student_id, verified_phone, created_at)
SELECT DISTINCT
  ear.instructor_id,
  ear.student_id,
  COALESCE(NULLIF(TRIM(sp.phone_number), ''), NULLIF(TRIM(u.phone), '')),
  COALESCE(ear.created_at, NOW())
FROM exam_access_requests ear
JOIN users u ON u.id = ear.student_id AND u.role = 'student'
LEFT JOIN student_profiles sp ON sp.user_id = u.id
WHERE UPPER(TRIM(ear.status)) IN ('PENDING', 'APPROVED')
ON CONFLICT (instructor_id, student_id) DO NOTHING;

-- usage_counters ilə uyğunlaşdır
INSERT INTO usage_counters (user_id, students_count, storage_used_mb, storage_used_bytes, sms_used_monthly, sms_period_ym)
SELECT
  ins.instructor_id,
  COUNT(DISTINCT ins.student_id)::int,
  0,
  0,
  0,
  to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku'), 'YYYY-MM')
FROM instructor_students ins
GROUP BY ins.instructor_id
ON CONFLICT (user_id) DO UPDATE
SET students_count = EXCLUDED.students_count,
    updated_at = NOW();

COMMIT;
