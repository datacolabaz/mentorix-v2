-- Account lifecycle for Google-first onboarding + instructor pre-provisioned students.
-- - active: normal account
-- - pending_google: created with email reserved for Google merge (still usable via phone/PIN)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_account_status_check;

ALTER TABLE users
  ADD CONSTRAINT users_account_status_check
  CHECK (account_status IN ('active', 'pending_google'));

UPDATE users
SET account_status = 'active'
WHERE account_status IS NULL OR trim(account_status) = '';

CREATE INDEX IF NOT EXISTS idx_users_account_status
  ON users (account_status);
