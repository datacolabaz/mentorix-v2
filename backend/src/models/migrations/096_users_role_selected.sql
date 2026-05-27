-- Track whether user has completed role selection onboarding.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role_selected BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_users_role_selected
  ON users (role_selected);

