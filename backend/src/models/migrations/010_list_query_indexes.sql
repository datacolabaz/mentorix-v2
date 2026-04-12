-- Sürət: müəllim tələbə/imtahan siyahıları və attendance orta balı
CREATE INDEX IF NOT EXISTS idx_enrollments_instructor_id ON enrollments (instructor_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_enrollment_id ON attendance (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_exams_instructor_id ON exams (instructor_id);
CREATE INDEX IF NOT EXISTS idx_exam_assignments_exam_id ON exam_assignments (exam_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role) WHERE is_active = TRUE;
