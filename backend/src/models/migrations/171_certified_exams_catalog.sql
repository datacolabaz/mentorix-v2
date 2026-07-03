-- Public certified exam catalog (moderated marketplace)

ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS category VARCHAR(32)
    CHECK (category IS NULL OR category IN ('beynelxalq', 'is-heyati')),
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_exams_public_catalog
  ON exams (category, created_at DESC)
  WHERE is_public = TRUE AND is_verified = TRUE AND COALESCE(is_deleted, FALSE) = FALSE;

CREATE TABLE IF NOT EXISTS waitlist_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  category VARCHAR(32),
  source VARCHAR(64) NOT NULL DEFAULT 'certified_catalog',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email, source)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_notifications_created
  ON waitlist_notifications (created_at DESC);
