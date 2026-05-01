-- Minimal event tracking for growth + billing funnel.

CREATE TABLE IF NOT EXISTS billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS billing_events_user_created_at
  ON billing_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS billing_events_event_created_at
  ON billing_events (event, created_at DESC);

