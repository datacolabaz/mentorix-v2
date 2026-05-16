-- Tədris mərkəzi (Kurs) admin rolu və profil cədvəli
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'instructor', 'student', 'parent', 'course'));

CREATE TABLE IF NOT EXISTS course_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  course_name VARCHAR(255),
  logo_url TEXT,
  branch_address TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  map_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE course_profiles IS 'Tədris mərkəzi (kurs) admin profili';
COMMENT ON COLUMN course_profiles.course_name IS 'Kursun ictimai adı';
COMMENT ON COLUMN course_profiles.map_visible IS 'Public xəritədə görünsün';

CREATE INDEX IF NOT EXISTS idx_course_profiles_map_coords
  ON course_profiles (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND map_visible = TRUE;
