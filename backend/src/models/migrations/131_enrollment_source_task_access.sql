-- Qrup linki (CRM) vs imtahan/tapşırıq linki (yüngül profil) ayrımı
ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS enrollment_source VARCHAR(24) NOT NULL DEFAULT 'manual';

COMMENT ON COLUMN enrollments.enrollment_source IS
  'group=qrup dəvət linki (CRM+ödəniş), exam=imtahan linki, task=tapşırıq linki, manual=müəllim əlavəsi';

CREATE TABLE IF NOT EXISTS task_access_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (UPPER(TRIM(status)) IN ('PENDING', 'APPROVED', 'REJECTED')),
  student_email TEXT,
  student_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_task_access_requests_assignment_student_pending
  ON task_access_requests (assignment_id, student_id)
  WHERE UPPER(TRIM(status)) = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_task_access_requests_instructor_pending
  ON task_access_requests (instructor_id, created_at DESC)
  WHERE UPPER(TRIM(status)) = 'PENDING';
