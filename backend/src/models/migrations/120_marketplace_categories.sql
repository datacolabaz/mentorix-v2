-- Hierarchical teaching categories, delivery formats, service areas, student inquiries

CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(100) PRIMARY KEY,
  parent_id VARCHAR(100) REFERENCES categories(id) ON DELETE SET NULL,
  slug VARCHAR(150) UNIQUE,
  name_az VARCHAR(255) NOT NULL,
  icon VARCHAR(50),
  is_popular BOOLEAN NOT NULL DEFAULT FALSE,
  is_virtual_category BOOLEAN NOT NULL DEFAULT FALSE,
  target_category_id VARCHAR(100) REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_popular ON categories(is_popular) WHERE is_popular = TRUE;

DO $$ BEGIN
  CREATE TYPE delivery_format AS ENUM ('online', 'teacher_place', 'student_place');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS instructor_categories (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id VARCHAR(100) NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_instructor_categories_category ON instructor_categories(category_id);

CREATE TABLE IF NOT EXISTS instructor_delivery_formats (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  format delivery_format NOT NULL,
  travel_radius_km INT NOT NULL DEFAULT 10 CHECK (travel_radius_km >= 0 AND travel_radius_km <= 200),
  UNIQUE (user_id, format)
);

CREATE INDEX IF NOT EXISTS idx_instructor_delivery_formats_user ON instructor_delivery_formats(user_id);

CREATE TABLE IF NOT EXISTS service_areas (
  id VARCHAR(50) PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  name_az VARCHAR(255) NOT NULL,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('district', 'metro')),
  sort_order INT NOT NULL DEFAULT 0,
  is_popular BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS instructor_service_areas (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area_id VARCHAR(50) NOT NULL REFERENCES service_areas(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, area_id)
);

ALTER TABLE instructor_profiles
  ADD COLUMN IF NOT EXISTS discover_hourly_rate NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS discover_bio TEXT,
  ADD COLUMN IF NOT EXISTS discover_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS teacher_place_address TEXT,
  ADD COLUMN IF NOT EXISTS map_search_radius_km INT NOT NULL DEFAULT 10;

COMMENT ON COLUMN instructor_profiles.map_search_radius_km IS 'Tələbə axtarışında görünürlük radiusu (km)';

CREATE TABLE IF NOT EXISTS student_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id VARCHAR(100) REFERENCES categories(id) ON DELETE SET NULL,
  requester_name VARCHAR(255) NOT NULL,
  requester_phone VARCHAR(30) NOT NULL,
  delivery_format delivery_format,
  student_level VARCHAR(120),
  message TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'archived')),
  contact_revealed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_inquiries_instructor ON student_inquiries(instructor_user_id, created_at DESC);

-- Bakı rayon və metro (axtarış filtri)
INSERT INTO service_areas (id, slug, name_az, kind, sort_order, is_popular) VALUES
  ('yasamal', 'yasamal', 'Yasamal', 'district', 10, TRUE),
  ('narimanov', 'narimanov', 'Nərimanov', 'district', 20, TRUE),
  ('xetai', 'xetai', 'Xətai', 'district', 30, TRUE),
  ('nizami', 'nizami', 'Nizami', 'district', 40, FALSE),
  ('sebail', 'sebail', 'Səbail', 'district', 50, FALSE),
  ('binagadi', 'binagadi', 'Binəqədi', 'district', 60, FALSE),
  ('suraxani', 'suraxani', 'Suraxanı', 'district', 70, FALSE),
  ('sabunchu', 'sabunchu', 'Sabunçu', 'district', 80, FALSE),
  ('xazar', 'xazar', 'Xəzər', 'district', 90, FALSE),
  ('qaradag', 'qaradag', 'Qaradağ', 'district', 100, FALSE),
  ('metro-28-may', '28-may', '28 May', 'metro', 110, TRUE),
  ('metro-elmler', 'elmler-akademiyasi', 'Elmlər Akademiyası', 'metro', 120, TRUE),
  ('metro-nariman', 'nariman-narimanov', 'Nəriman Nərimanov', 'metro', 130, TRUE),
  ('metro-genclik', 'genclik', 'Gənclik', 'metro', 140, TRUE),
  ('metro-sahil', 'sahil', 'Sahil', 'metro', 150, FALSE),
  ('metro-iceriseher', 'iceriseher', 'İçərişəhər', 'metro', 160, FALSE),
  ('metro-azadliq', 'azadliq', 'Azadlıq prospekti', 'metro', 170, FALSE),
  ('metro-dernegul', 'dernegul', 'Dərnəgül', 'metro', 180, FALSE),
  ('metro-hezi-aslanov', 'hezi-aslanov', 'Həzi Aslanov', 'metro', 190, FALSE),
  ('metro-bakmil', 'bakmil', 'Bakmil', 'metro', 200, FALSE)
ON CONFLICT (id) DO NOTHING;
