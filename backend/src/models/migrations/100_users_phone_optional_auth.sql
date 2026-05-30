-- Auth: email is primary login; phone optional (instructor-added students may still have phone).

BEGIN;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_key;

ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_norm_unique_not_null
  ON users (regexp_replace(COALESCE(phone::text, ''), '[^0-9]', '', 'g'))
  WHERE phone IS NOT NULL AND trim(COALESCE(phone::text, '')) <> '';

COMMIT;
