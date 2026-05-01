-- Notification queue for SMS/email retries + idempotency.

CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL, -- sms | email
  event_type TEXT NOT NULL,
  unique_key TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  instructor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  to_addr TEXT, -- email or phone
  subject TEXT,
  body TEXT,
  context JSONB,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed | retrying
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_queue_unique_key
  ON notification_queue (unique_key);

CREATE INDEX IF NOT EXISTS notification_queue_due
  ON notification_queue (status, next_retry_at);

