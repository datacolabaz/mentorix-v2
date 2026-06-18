-- Tədris materialları kitabxanası (private fayllar, qrup/tapşırıq ilə əlaqə)

BEGIN;

CREATE TABLE IF NOT EXISTS course_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  storage_filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  original_filename TEXT,
  group_id UUID NULL REFERENCES instructor_groups(id) ON DELETE SET NULL,
  subject_id UUID NULL REFERENCES instructor_subjects(id) ON DELETE SET NULL,
  enrollment_lesson_id UUID NULL REFERENCES enrollment_lessons(id) ON DELETE SET NULL,
  assignment_id UUID NULL REFERENCES assignments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_materials_instructor ON course_materials (instructor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_materials_group ON course_materials (group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_course_materials_assignment ON course_materials (assignment_id) WHERE assignment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS course_material_blobs (
  filename TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  data BYTEA NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_material_blobs_created ON course_material_blobs (created_at);

COMMIT;
