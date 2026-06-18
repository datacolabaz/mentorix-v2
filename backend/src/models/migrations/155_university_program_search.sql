-- Universitet və proqram axtarışı + apply modulu (AI tövsiyə üçün genişlənə bilən struktur)

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Mövcud users cədvəlini genişləndirmək əvəzinə ayrıca applicant profili
CREATE TABLE IF NOT EXISTS university_applicant_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT,
  nationality TEXT,
  current_degree TEXT,
  gpa NUMERIC(4, 2) CHECK (gpa IS NULL OR (gpa >= 0 AND gpa <= 4)),
  language_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  work_exp TEXT,
  research_exp TEXT,
  budget_range TEXT,
  preferred_countries TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_univ_applicant_profiles_countries
  ON university_applicant_profiles USING GIN (preferred_countries);

CREATE TABLE IF NOT EXISTS universities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  city TEXT,
  world_ranking INTEGER,
  logo_url TEXT,
  housing_info TEXT,
  funding_info TEXT,
  slug TEXT UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_universities_country ON universities (country) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_universities_ranking ON universities (world_ranking NULLS LAST) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_universities_name_trgm ON universities USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uni_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  degree_level TEXT NOT NULL CHECK (degree_level IN ('BSc', 'MSc', 'PhD')),
  name TEXT NOT NULL,
  field TEXT NOT NULL,
  duration_years NUMERIC(3, 1),
  tuition_fee NUMERIC(12, 2),
  scholarship_available BOOLEAN NOT NULL DEFAULT false,
  language TEXT,
  intake_months TEXT[] NOT NULL DEFAULT '{}',
  deadline_dates DATE[] NOT NULL DEFAULT '{}',
  requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  apply_link TEXT,
  portal_source TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_programs_uni ON programs (uni_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_programs_degree_field ON programs (degree_level, field) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_programs_scholarship ON programs (scholarship_available) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_programs_tuition ON programs (tuition_fee NULLS LAST) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_programs_requirements ON programs USING GIN (requirements);

CREATE TABLE IF NOT EXISTS university_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'accepted')),
  applied_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, program_id)
);

CREATE INDEX IF NOT EXISTS idx_univ_applications_user ON university_applications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_univ_applications_program ON university_applications (program_id);
CREATE INDEX IF NOT EXISTS idx_univ_applications_status ON university_applications (status);

CREATE TABLE IF NOT EXISTS university_saved_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_univ_saved_searches_user ON university_saved_searches (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_univ_saved_searches_filters ON university_saved_searches USING GIN (filters_json);

COMMIT;
