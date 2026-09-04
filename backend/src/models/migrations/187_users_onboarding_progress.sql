-- Persist Digital Mentor walkthrough progress per user (never on login screen).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_progress JSONB NOT NULL DEFAULT '{}'::jsonb;
