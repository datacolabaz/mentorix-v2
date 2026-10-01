-- MANUAL rollback for migration 223_hash_auth_tokens.sql.
-- This folder is NOT read by scripts/migrate.js. Never copy this file into src/models/migrations/.
--
-- Run only after the application code that writes the hash columns has been rolled back.
-- Effect: outstanding hash-only reset links and verification links/codes stop working (users
-- request a new one; reset links live 30 min, verification 60 min). No plaintext is restored.
--
-- Usage (non-production first):
--   psql "$DATABASE_URL" -f backend/scripts/sql/rollback/223_hash_auth_tokens.rollback.sql

BEGIN;

SET LOCAL lock_timeout = '10s';

-- Hash-only reset rows cannot satisfy the old NOT NULL `token`; they are unusable by old code anyway.
DELETE FROM password_reset_tokens WHERE token IS NULL;

DROP INDEX IF EXISTS idx_password_reset_tokens_token_hash_unique;
ALTER TABLE password_reset_tokens DROP COLUMN IF EXISTS token_hash;
ALTER TABLE password_reset_tokens ALTER COLUMN token SET NOT NULL;

DROP INDEX IF EXISTS idx_users_verification_token_hash_unique;
ALTER TABLE users
  DROP COLUMN IF EXISTS verification_code_hash,
  DROP COLUMN IF EXISTS verification_token_hash;

DELETE FROM schema_migrations WHERE filename = '223_hash_auth_tokens.sql';

COMMIT;
