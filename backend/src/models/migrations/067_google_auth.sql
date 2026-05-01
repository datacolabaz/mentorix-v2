-- Google auth support: link user accounts to Google subject.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_sub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_unique_not_null
  ON users (google_sub)
  WHERE google_sub IS NOT NULL AND trim(google_sub) <> '';

