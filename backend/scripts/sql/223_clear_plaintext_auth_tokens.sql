-- MANUAL, one-off: end of the plaintext-token transition window for migration 223.
-- Run once the hashing code has been live for longer than the longest token lifetime
-- (password reset 30 min, email verification EMAIL_VERIFICATION_TTL_MINUTES, default 60 min),
-- e.g. a day after the deploy. Then remove the plaintext fallbacks marked
-- "TODO(223-plaintext-window)" in the code.
--
-- Effect: no plaintext reset/verification secret remains in the database. Any pre-deploy link
-- still unused simply stops working (it would already have expired).
--
-- Usage:
--   psql "$DATABASE_URL" -f backend/scripts/sql/223_clear_plaintext_auth_tokens.sql

BEGIN;

SET LOCAL lock_timeout = '10s';

UPDATE password_reset_tokens
SET token = NULL
WHERE token IS NOT NULL;

UPDATE users
SET verification_token = NULL,
    verification_code = NULL
WHERE verification_token IS NOT NULL OR verification_code IS NOT NULL;

COMMIT;
