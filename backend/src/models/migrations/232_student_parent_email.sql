-- Optional parent contact email on the student profile ("Valideyn emaili"). Edited only by the
-- student's teacher (active enrollment) or an admin. The parent result summary is emailed here in
-- addition to (or instead of) the linked parent account; the address can be unsubscribed with a
-- signed one-click link, which sets parent_email_opt_out_at. Changing the address clears the opt-out.
-- Rollback (manual): backend/scripts/sql/rollback/232_student_parent_email.rollback.sql

SET LOCAL lock_timeout = '10s';

ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS parent_email TEXT;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS parent_email_opt_out_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_profiles_parent_email_len_chk'
  ) THEN
    ALTER TABLE student_profiles
      ADD CONSTRAINT student_profiles_parent_email_len_chk
      CHECK (parent_email IS NULL OR char_length(parent_email) BETWEEN 3 AND 254) NOT VALID;
  END IF;
END $$;

COMMENT ON COLUMN student_profiles.parent_email IS
  'Optional parent contact email (lowercase). Receives the parent result summary; never shown to other students.';
COMMENT ON COLUMN student_profiles.parent_email_opt_out_at IS
  'Set when the parent address unsubscribed via the signed email link; cleared when the address changes.';
