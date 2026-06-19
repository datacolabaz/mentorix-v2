-- Mastersportal kataloq skrayp target-ləri üçün genişləndirmə

BEGIN;

ALTER TABLE university_scrape_targets
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'university',
  ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT 'university',
  ADD COLUMN IF NOT EXISTS field_slug TEXT,
  ADD COLUMN IF NOT EXISTS degree_type TEXT
    CHECK (degree_type IS NULL OR degree_type IN ('BSc', 'MSc', 'PhD'));

UPDATE university_scrape_targets
SET
  source_type = 'university',
  target_type = 'university'
WHERE target_type IS NULL OR target_type = '' OR source_type IS NULL OR source_type = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_univ_scrape_targets_catalog_field_degree
  ON university_scrape_targets (field_slug, degree_type, source_type)
  WHERE target_type = 'catalog' AND field_slug IS NOT NULL AND degree_type IS NOT NULL;

COMMIT;
