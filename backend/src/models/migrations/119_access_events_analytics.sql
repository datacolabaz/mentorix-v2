-- Analitika: trafik mənbəyi, UTM, səhifə və funnel hadisələri
ALTER TABLE access_events ADD COLUMN IF NOT EXISTS referrer_source VARCHAR(32);
ALTER TABLE access_events ADD COLUMN IF NOT EXISTS utm_source VARCHAR(128);
ALTER TABLE access_events ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_access_events_referrer_created
  ON access_events (referrer_source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_access_events_path_created
  ON access_events (path, created_at DESC)
  WHERE path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_access_events_funnel
  ON access_events (event_type, created_at DESC);
