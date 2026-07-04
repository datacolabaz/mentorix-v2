-- Explicit RU columns for catalog entities (in addition to translations JSONB)

ALTER TABLE exam_categories
  ADD COLUMN IF NOT EXISTS name_ru TEXT,
  ADD COLUMN IF NOT EXISTS description_ru TEXT;

ALTER TABLE career_paths
  ADD COLUMN IF NOT EXISTS name_ru TEXT,
  ADD COLUMN IF NOT EXISTS description_ru TEXT;

ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS title_ru TEXT;

COMMENT ON COLUMN exam_categories.name_ru IS 'Russian display name; used when ?lang=ru';
COMMENT ON COLUMN career_paths.name_ru IS 'Russian display name; used when ?lang=ru';
COMMENT ON COLUMN exams.title_ru IS 'Russian exam title; used when ?lang=ru';
