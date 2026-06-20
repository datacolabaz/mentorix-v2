-- ABŞ universitetləri üçün Private/Public tipi

BEGIN;

ALTER TABLE universities
  ADD COLUMN IF NOT EXISTS university_type TEXT
    CHECK (university_type IS NULL OR university_type IN ('Private', 'Public'));

CREATE INDEX IF NOT EXISTS idx_universities_type
  ON universities (university_type)
  WHERE is_active = true AND university_type IS NOT NULL;

COMMIT;
