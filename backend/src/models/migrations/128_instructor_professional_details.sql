-- Peşəkar məlumatlar (Tənzimləmələr → PEŞƏKAR MƏLUMATLAR)
ALTER TABLE instructor_profiles
  ADD COLUMN IF NOT EXISTS education TEXT,
  ADD COLUMN IF NOT EXISTS experience_years INTEGER,
  ADD COLUMN IF NOT EXISTS bio VARCHAR(300);

UPDATE instructor_profiles
SET
  education = COALESCE(NULLIF(TRIM(education), ''), NULLIF(TRIM(discover_education), '')),
  bio = COALESCE(NULLIF(TRIM(bio), ''), NULLIF(TRIM(discover_bio), ''))
WHERE (education IS NULL OR TRIM(education) = '')
   OR (bio IS NULL OR TRIM(bio) = '');
