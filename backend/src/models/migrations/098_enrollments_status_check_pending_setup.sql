-- Allow pending_setup lifecycle in enrollments.status

ALTER TABLE enrollments
  DROP CONSTRAINT IF EXISTS enrollments_status_check;

ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_status_check
  CHECK (LOWER(TRIM(COALESCE(status, 'active'))) IN ('active', 'pending_setup', 'paused', 'archived', 'left'));

