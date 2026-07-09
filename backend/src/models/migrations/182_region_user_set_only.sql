-- Yalnız müəllimin özü seçdiyi rayon axtarışda görünsün (backfill məlumatını təmizlə)
ALTER TABLE instructor_profiles
  ADD COLUMN IF NOT EXISTS region_user_set BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN instructor_profiles.region_user_set IS 'TRUE = müəllim Tənzimləmələrdə şəhər/rayonu özü seçib';

UPDATE instructor_profiles
SET region = NULL,
    baku_district = NULL,
    region_user_set = FALSE
WHERE region_user_set = FALSE;
