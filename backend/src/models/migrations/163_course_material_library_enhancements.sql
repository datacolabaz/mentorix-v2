-- Kitabxana gücləndirməsi: tag, paylaşım, statistika, imtahan/tapşırıq əlaqələri

BEGIN;

ALTER TABLE course_materials
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_token VARCHAR(64) UNIQUE,
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_course_materials_tags ON course_materials USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_course_materials_share_token
  ON course_materials (share_token) WHERE share_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS exam_material_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES course_materials(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_id, material_id)
);

CREATE TABLE IF NOT EXISTS assignment_material_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES course_materials(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_material_links_exam ON exam_material_links (exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_material_links_material ON exam_material_links (material_id);
CREATE INDEX IF NOT EXISTS idx_assignment_material_links_assignment ON assignment_material_links (assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_material_links_material ON assignment_material_links (material_id);

COMMIT;
