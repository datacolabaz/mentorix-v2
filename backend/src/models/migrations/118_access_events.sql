-- Giriş/çıxış və cihaz statistikası (admin panel)
CREATE TABLE IF NOT EXISTS access_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(32) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  role VARCHAR(32),
  path VARCHAR(512),
  device_type VARCHAR(16) NOT NULL DEFAULT 'unknown',
  session_key VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_events_created_at ON access_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_events_type_day ON access_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_events_user_day ON access_events (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
