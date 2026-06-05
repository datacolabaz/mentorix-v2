-- İmtahan/tapşırıq iştirakçıları üçün avtomatik sistem qrupları

ALTER TABLE instructor_subjects
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE instructor_groups
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS system_kind TEXT,
  ADD COLUMN IF NOT EXISTS system_ref_id UUID;

ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS participant_group_id UUID REFERENCES instructor_groups(id) ON DELETE SET NULL;

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS participant_group_id UUID REFERENCES instructor_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_instructor_groups_system_ref
  ON instructor_groups (instructor_id, system_kind, system_ref_id)
  WHERE is_system = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_instructor_groups_exam_participants
  ON instructor_groups (instructor_id, system_ref_id)
  WHERE is_system = TRUE AND system_kind = 'exam_participants';

CREATE UNIQUE INDEX IF NOT EXISTS uq_instructor_groups_assignment_participants
  ON instructor_groups (instructor_id, system_ref_id)
  WHERE is_system = TRUE AND system_kind = 'assignment_participants';

COMMENT ON COLUMN instructor_groups.is_system IS 'Avtomatik imtahan/tapşırıq iştirakçı qrupu';
COMMENT ON COLUMN instructor_groups.system_kind IS 'exam_participants | assignment_participants';
COMMENT ON COLUMN exams.participant_group_id IS 'İmtahan iştirakçılarının sistem qrupu';
