-- Görünən rol: UI-da "Müəllim" və ya "Təlimçi"
ALTER TABLE instructor_profiles
  ADD COLUMN IF NOT EXISTS public_label VARCHAR(32) DEFAULT 'instructor';

UPDATE instructor_profiles SET public_label = 'instructor' WHERE public_label IS NULL OR TRIM(public_label) = '';

-- Tədris sahələri və qruplar (müəllim başına)
CREATE TABLE IF NOT EXISTS instructor_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS instructor_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES instructor_subjects(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instructor_subjects_instructor ON instructor_subjects(instructor_id);
CREATE INDEX IF NOT EXISTS idx_instructor_groups_instructor ON instructor_groups(instructor_id);
CREATE INDEX IF NOT EXISTS idx_instructor_groups_subject ON instructor_groups(subject_id);

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES instructor_subjects(id) ON DELETE SET NULL;

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES instructor_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_subject ON enrollments(subject_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_group ON enrollments(group_id);
