-- Müəllim axtarışı: km/coordinat əvəzinə şəhər/rayon
ALTER TABLE instructor_profiles
  ADD COLUMN IF NOT EXISTS region VARCHAR(100),
  ADD COLUMN IF NOT EXISTS baku_district VARCHAR(100);

COMMENT ON COLUMN instructor_profiles.region IS 'Şəhər və ya rayon adı (məs. Bakı, Gəncə, Abşeron)';
COMMENT ON COLUMN instructor_profiles.baku_district IS 'Bakı şəhəri üçün inzibati rayon; yalnız region=Bakı olanda';

CREATE INDEX IF NOT EXISTS idx_instructor_profiles_region
  ON instructor_profiles (region)
  WHERE region IS NOT NULL AND COALESCE(map_visible, TRUE) = TRUE;

CREATE INDEX IF NOT EXISTS idx_instructor_profiles_baku_district
  ON instructor_profiles (baku_district)
  WHERE baku_district IS NOT NULL AND COALESCE(map_visible, TRUE) = TRUE;
