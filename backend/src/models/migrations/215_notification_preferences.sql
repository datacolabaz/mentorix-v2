-- Phase A: bildiriş seçimləri. Yalnız istifadəçinin dəyişdiyi (override) sətirlər saxlanılır;
-- default matris kodda: backend/src/config/notificationPolicy.js.
-- Məcburi (security) kateqoriyalar kodda kilidlidir — burada saxlanılsa belə nəzərə alınmır.
-- Rollback: backend/scripts/sql/rollback/215_notification_preferences.rollback.sql (əl ilə).

SET LOCAL lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL
    CHECK (category IN ('security', 'assessment', 'assignment', 'material', 'group', 'grading', 'partner', 'billing', 'system')),
  event_type TEXT, -- NULL = kateqoriya səviyyəsi
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  frequency TEXT NOT NULL DEFAULT 'immediate'
    CHECK (frequency IN ('immediate', 'daily', 'weekly', 'off')),
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_prefs
  ON notification_preferences (user_id, category, (COALESCE(event_type, '')), channel);
