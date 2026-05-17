-- Kurs heyəti: status (INVITED | ACTIVE), mövcud is_active ilə uyğun
ALTER TABLE course_teachers
  ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE course_teachers DROP CONSTRAINT IF EXISTS course_teachers_status_check;
ALTER TABLE course_teachers
  ADD CONSTRAINT course_teachers_status_check CHECK (status IN ('INVITED', 'ACTIVE'));

UPDATE course_teachers SET status = 'ACTIVE' WHERE COALESCE(is_active, TRUE) = TRUE;
UPDATE course_teachers SET status = 'INVITED' WHERE COALESCE(is_active, FALSE) = TRUE;

COMMENT ON COLUMN course_teachers.status IS 'Kurs müəllimi: INVITED (dəvət) və ya ACTIVE (aktiv heyət)';
