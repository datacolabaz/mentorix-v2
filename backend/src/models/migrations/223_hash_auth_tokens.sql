-- Password-reset and email-verification secrets are stored as SHA-256 hashes only
-- (lib/secretTokens.js). Additive and idempotent: nullable columns, partial unique indexes,
-- and `token` on password_reset_tokens becomes nullable (metadata-only change) because new
-- rows store no plaintext. No backfill: rows issued before the deploy keep their plaintext
-- and are accepted by a short dual-read window in code (see emailVerificationIssue.js /
-- passwordResetTokenService.js), then cleared with backend/scripts/sql/223_clear_plaintext_auth_tokens.sql.
-- Both partial indexes are built while every value is NULL (one scan, nothing to sort).
-- Rollback (manual): backend/scripts/sql/rollback/223_hash_auth_tokens.rollback.sql

SET LOCAL lock_timeout = '10s';

ALTER TABLE password_reset_tokens
  ADD COLUMN IF NOT EXISTS token_hash TEXT;

ALTER TABLE password_reset_tokens
  ALTER COLUMN token DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash_unique
  ON password_reset_tokens (token_hash)
  WHERE token_hash IS NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verification_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS verification_code_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_verification_token_hash_unique
  ON users (verification_token_hash)
  WHERE verification_token_hash IS NOT NULL;
