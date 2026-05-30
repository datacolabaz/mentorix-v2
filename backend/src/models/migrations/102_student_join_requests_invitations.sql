-- Qrup dəvəti: invitation_code/link + tələbə qoşulma sorğuları (PENDING → APPROVED/REJECTED)

ALTER TABLE instructor_groups
  ADD COLUMN IF NOT EXISTS invitation_code VARCHAR(32),
  ADD COLUMN IF NOT EXISTS invitation_link TEXT;

UPDATE instructor_groups
SET invitation_code = join_code
WHERE invitation_code IS NULL AND join_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_instructor_groups_invitation_code_upper
  ON instructor_groups (UPPER(TRIM(invitation_code)))
  WHERE invitation_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS student_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES instructor_groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (UPPER(TRIM(status)) IN ('PENDING', 'APPROVED', 'REJECTED')),
  first_name TEXT,
  last_name TEXT,
  phone_number TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_join_requests_enrollment
  ON student_join_requests (enrollment_id);

CREATE INDEX IF NOT EXISTS idx_student_join_requests_instructor_pending
  ON student_join_requests (instructor_id)
  WHERE UPPER(TRIM(status)) = 'PENDING';

ALTER TABLE enrollments
  DROP CONSTRAINT IF EXISTS enrollments_status_check;

ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_status_check
  CHECK (
    LOWER(TRIM(COALESCE(status, 'active'))) IN (
      'active',
      'pending_setup',
      'pending_approval',
      'paused',
      'archived',
      'left',
      'rejected'
    )
  );
