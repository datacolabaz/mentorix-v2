-- İmtahan materialları (PNG/PDF): Railway kimi mühitlərdə disk deploydan sonra itir
-- Fayl məzmunu PostgreSQL-də saxlanılır; URL-lər köhnə qalır (/api/uploads/exams/...).

CREATE TABLE IF NOT EXISTS exam_material_blobs (
  filename TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  data BYTEA NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_material_blobs_created ON exam_material_blobs (created_at);
