-- Xəritədə axtarış: koordinatlar və müəllim / təlimçi növü
ALTER TABLE instructor_profiles
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS map_profile_kind VARCHAR(20) NOT NULL DEFAULT 'teacher'
    CHECK (map_profile_kind IN ('teacher', 'trainer')),
  ADD COLUMN IF NOT EXISTS map_visible BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN instructor_profiles.latitude IS 'Enlik (WGS84), public xəritə üçün';
COMMENT ON COLUMN instructor_profiles.longitude IS 'Uzunluq (WGS84), public xəritə üçün';
COMMENT ON COLUMN instructor_profiles.map_profile_kind IS 'teacher | trainer — pin rəngi / filter';
COMMENT ON COLUMN instructor_profiles.map_visible IS 'FALSE olsa public API-da göstərilmir';

CREATE INDEX IF NOT EXISTS idx_instructor_profiles_map_coords
  ON instructor_profiles (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND map_visible = TRUE;
