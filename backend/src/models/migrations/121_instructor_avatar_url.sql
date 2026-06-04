-- Müəllim profil şəkli (ictimai axtarış / bio)
ALTER TABLE instructor_profiles
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512) DEFAULT NULL;

COMMENT ON COLUMN instructor_profiles.avatar_url IS 'Müəllim profil şəkli — /api/uploads/instructor-avatars/...';
