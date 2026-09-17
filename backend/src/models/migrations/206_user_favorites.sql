-- Persisted instructor favorites for the authenticated single identity.
CREATE TABLE IF NOT EXISTS user_favorites (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, instructor_id),
  CONSTRAINT user_favorites_not_self CHECK (user_id <> instructor_id)
);
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_created
  ON user_favorites (user_id, created_at DESC);
