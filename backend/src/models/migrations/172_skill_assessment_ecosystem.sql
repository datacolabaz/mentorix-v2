-- Skill Assessment Ecosystem: hierarchical categories, career paths, user progress

CREATE TABLE IF NOT EXISTS exam_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID REFERENCES exam_categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(128) NOT NULL UNIQUE,
  icon VARCHAR(32),
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_categories_parent ON exam_categories (parent_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_exam_categories_slug ON exam_categories (slug);

CREATE TABLE IF NOT EXISTS career_paths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES exam_categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(128) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(32),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_paths_category ON career_paths (category_id, sort_order);

CREATE TABLE IF NOT EXISTS career_path_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  career_path_id UUID NOT NULL REFERENCES career_paths(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (career_path_id, exam_id),
  UNIQUE (career_path_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_career_path_steps_path ON career_path_steps (career_path_id, step_order);

CREATE TABLE IF NOT EXISTS user_skill_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES exam_categories(id) ON DELETE CASCADE,
  current_level VARCHAR(32) NOT NULL DEFAULT 'beginner'
    CHECK (current_level IN ('beginner', 'intermediate', 'advanced', 'professional')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_user_skill_progress_user ON user_skill_progress (user_id);

-- DEPRECATED: exams.category (text) from migration 171 — use category_id → exam_categories instead.
COMMENT ON COLUMN exams.category IS
  'DEPRECATED: use category_id (exam_categories). Legacy beynelxalq|is-heyati only; do not write new values.';

ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES exam_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS level VARCHAR(32) NOT NULL DEFAULT 'beginner',
  ADD COLUMN IF NOT EXISTS certificate_type VARCHAR(32) NOT NULL DEFAULT 'professional';

ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_level_check;
ALTER TABLE exams ADD CONSTRAINT exams_level_check
  CHECK (level IN ('beginner', 'intermediate', 'advanced', 'professional'));

ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_certificate_type_check;
ALTER TABLE exams ADD CONSTRAINT exams_certificate_type_check
  CHECK (certificate_type IN ('preparation', 'professional', 'fundamentals'));

CREATE INDEX IF NOT EXISTS idx_exams_category_id ON exams (category_id)
  WHERE COALESCE(is_deleted, FALSE) = FALSE;

DROP INDEX IF EXISTS idx_exams_public_catalog;
CREATE INDEX IF NOT EXISTS idx_exams_public_catalog
  ON exams (category_id, created_at DESC)
  WHERE is_public = TRUE AND is_verified = TRUE AND COALESCE(is_deleted, FALSE) = FALSE;

ALTER TABLE waitlist_notifications
  ADD COLUMN IF NOT EXISTS category_slug VARCHAR(128);
