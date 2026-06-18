-- AI skrayper + mentor crowdsourcing üçün genişləndirmə

BEGIN;

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'seed'
    CHECK (source_type IN ('seed', 'scraper', 'mentor', 'admin')),
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (review_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS contributor_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mentor_display_name TEXT,
  ADD COLUMN IF NOT EXISTS scrape_url TEXT,
  ADD COLUMN IF NOT EXISTS ai_extracted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_programs_review_status ON programs (review_status, is_active);
CREATE INDEX IF NOT EXISTS idx_programs_contributor ON programs (contributor_user_id) WHERE contributor_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_programs_source_type ON programs (source_type);

CREATE UNIQUE INDEX IF NOT EXISTS idx_programs_uni_name_degree
  ON programs (uni_id, name, degree_level);

CREATE TABLE IF NOT EXISTS university_scrape_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_name TEXT NOT NULL,
  country TEXT NOT NULL,
  admission_url TEXT NOT NULL,
  degree_hint TEXT,
  field_hint TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_scraped_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_univ_scrape_targets_url ON university_scrape_targets (admission_url);

CREATE TABLE IF NOT EXISTS university_scrape_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_id UUID REFERENCES university_scrape_targets(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  programs_found INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  ai_model TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_univ_scrape_runs_target ON university_scrape_runs (target_id, started_at DESC);

INSERT INTO university_scrape_targets (university_name, country, admission_url, degree_hint, field_hint)
VALUES
  ('Technical University of Munich', 'Almaniya', 'https://www.tum.de/en/studies/application', 'MSc', 'computer_science'),
  ('Warsaw University of Technology', 'Polşa', 'https://www.pw.edu.pl/engpw/Studies/Admission', 'MSc', 'data_science'),
  ('Politecnico di Milano', 'İtaliya', 'https://www.polimi.it/en/prospective-students', 'MSc', 'engineering'),
  ('University of Bologna', 'İtaliya', 'https://www.unibo.it/en/study', 'MSc', 'business_administration'),
  ('Heidelberg University', 'Almaniya', 'https://www.uni-heidelberg.de/en/study', 'PhD', 'biology')
ON CONFLICT (admission_url) DO NOTHING;

COMMIT;
