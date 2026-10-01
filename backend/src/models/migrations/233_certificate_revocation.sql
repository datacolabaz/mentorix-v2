-- Admin certificate revoke / reinstate. status 'revoked' was already allowed by migration 169; these
-- columns record when and by whom (the reason is internal: the public verify page shows only the date).
-- Every revoke/reinstate is also written to admin_access_audit (with the reason) before the change.
-- Rollback (manual): backend/scripts/sql/rollback/233_certificate_revocation.rollback.sql

SET LOCAL lock_timeout = '10s';

ALTER TABLE certificates ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS revoke_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'certificates_revoke_reason_len_chk'
  ) THEN
    ALTER TABLE certificates
      ADD CONSTRAINT certificates_revoke_reason_len_chk
      CHECK (revoke_reason IS NULL OR char_length(revoke_reason) <= 1000) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_certificates_revoked
  ON certificates (student_id, exam_id)
  WHERE status = 'revoked';

COMMENT ON COLUMN certificates.revoked_at IS 'When an admin revoked the certificate (shown on the public verify page).';
COMMENT ON COLUMN certificates.revoke_reason IS 'Internal admin reason; never shown publicly.';
