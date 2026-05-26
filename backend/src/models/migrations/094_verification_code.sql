-- 6 rəqəmli email təsdiq kodu (link ilə birlikdə və ya ayrıca)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verification_code VARCHAR(10);

CREATE INDEX IF NOT EXISTS idx_users_verification_code
  ON users (verification_code)
  WHERE verification_code IS NOT NULL;
