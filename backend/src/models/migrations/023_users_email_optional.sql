-- Make users.email non-unique globally; keep optional uniqueness only when email is present.
-- This supports phone/PIN-first flows where students may have NULL email.

ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE t.relname = 'users'
      AND n.nspname = 'public'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%email%'
  LOOP
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique_not_null
  ON users (lower(trim(email)))
  WHERE email IS NOT NULL AND trim(email) <> '';
