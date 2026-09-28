-- Google-only autentifikasiya: identity = users.google_sub (OpenID Connect `sub`),
-- email/ad/şəkil/email_verified yalnız profil atributlarıdır.

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_email_verified BOOLEAN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_picture_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_linked_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_google_login_at TIMESTAMPTZ;

UPDATE users
SET google_linked_at = COALESCE(google_linked_at, created_at)
WHERE google_sub IS NOT NULL AND TRIM(google_sub) <> '' AND google_linked_at IS NULL;

-- Təhlükəsizlik və dəstək üçün autentifikasiya jurnalı
CREATE TABLE IF NOT EXISTS auth_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event TEXT NOT NULL CHECK (event IN (
    'google_sign_in',
    'google_sign_up',
    'account_link_offered',
    'account_linked',
    'account_link_declined',
    'login_failed',
    'legacy_login_blocked',
    'account_switch'
  )),
  google_sub TEXT,
  email TEXT,
  ip TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_events_user_time ON auth_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_event_time ON auth_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_sub ON auth_events (google_sub) WHERE google_sub IS NOT NULL;
