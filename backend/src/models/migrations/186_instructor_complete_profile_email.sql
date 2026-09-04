-- Persist UI language for transactional emails, and track incomplete-profile reminders.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS locale VARCHAR(8) NOT NULL DEFAULT 'az';

ALTER TABLE instructor_profiles
  ADD COLUMN IF NOT EXISTS complete_profile_email_sent_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS complete_profile_email_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_instructor_complete_profile_email
  ON instructor_profiles (complete_profile_email_sent_at)
  WHERE COALESCE(complete_profile_email_count, 0) < 2;
