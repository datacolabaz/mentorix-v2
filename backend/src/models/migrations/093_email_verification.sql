-- Email verification using external provider (Resend).
-- Stores token + expiry, and blocks login until confirmed.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verification_token TEXT,
  ADD COLUMN IF NOT EXISTS verification_expiry TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT TRUE;

-- Fast lookup during verification.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_verification_token_unique
  ON users (verification_token)
  WHERE verification_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_is_verified
  ON users (is_verified);

