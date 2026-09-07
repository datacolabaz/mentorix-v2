-- Müəllim təqdimatları: PDF blob + slayd annotasiyaları (PDF original dəyişmir)

BEGIN;

CREATE TABLE IF NOT EXISTS presentations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  storage_filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0 AND file_size <= 27262976),
  original_filename TEXT,
  slide_count INT NOT NULL DEFAULT 0 CHECK (slide_count >= 0),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_presentations_storage_filename
  ON presentations (storage_filename);
CREATE INDEX IF NOT EXISTS idx_presentations_instructor
  ON presentations (instructor_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS presentation_blobs (
  filename TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  data BYTEA NOT NULL,
  byte_size BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS presentation_annotations (
  presentation_id UUID NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
  slide_index INT NOT NULL CHECK (slide_index >= 0),
  strokes JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (presentation_id, slide_index)
);

COMMIT;
