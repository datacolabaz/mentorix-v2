-- Xarici tələbələr üçün tək material paylaşımı (WhatsApp və s.)

BEGIN;

CREATE TABLE IF NOT EXISTS course_material_guest_students (
  material_id UUID NOT NULL REFERENCES course_materials(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (material_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_course_material_guest_students_student
  ON course_material_guest_students (student_id);

COMMIT;
