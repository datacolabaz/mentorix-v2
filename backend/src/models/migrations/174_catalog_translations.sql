-- Localized names for catalog entities (az / ru / en)

ALTER TABLE exam_categories
  ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE career_paths
  ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN exams.category IS
  'DEPRECATED: use category_id (exam_categories). Legacy beynelxalq|is-heyati only; do not write new values.';
