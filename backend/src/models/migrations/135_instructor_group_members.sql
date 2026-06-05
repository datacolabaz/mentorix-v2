-- Çoxlu iştirakçı qrupu: enrollment başına bir sətir məhdudiyyətinə görə üzvlük cədvəli

CREATE TABLE IF NOT EXISTS instructor_group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES instructor_groups(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES instructor_subjects(id) ON DELETE SET NULL,
  membership_source TEXT NOT NULL DEFAULT 'exam',
  source_ref_id UUID,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT instructor_group_members_source_check
    CHECK (LOWER(TRIM(membership_source)) IN ('exam', 'task', 'group'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_instructor_group_members_group_student
  ON instructor_group_members (group_id, student_id);

CREATE INDEX IF NOT EXISTS idx_instructor_group_members_instructor
  ON instructor_group_members (instructor_id, joined_at DESC);

CREATE INDEX IF NOT EXISTS idx_instructor_group_members_student
  ON instructor_group_members (student_id);
