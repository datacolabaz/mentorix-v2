CREATE TABLE IF NOT EXISTS site_marketing_configs (
  slug TEXT PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_marketing_configs_updated ON site_marketing_configs (updated_at DESC);
