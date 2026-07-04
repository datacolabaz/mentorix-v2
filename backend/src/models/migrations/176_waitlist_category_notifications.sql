-- Waitlist v2: per-category subscriptions + notification tracking

ALTER TABLE waitlist_notifications
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES exam_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

UPDATE waitlist_notifications w
SET category_id = ec.id
FROM exam_categories ec
WHERE w.category_id IS NULL
  AND w.category_slug IS NOT NULL
  AND ec.slug = w.category_slug;

ALTER TABLE waitlist_notifications DROP CONSTRAINT IF EXISTS waitlist_notifications_email_source_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email_category
  ON waitlist_notifications (email, category_id)
  WHERE category_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email_general
  ON waitlist_notifications (email)
  WHERE category_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_waitlist_pending_category
  ON waitlist_notifications (category_id, created_at DESC)
  WHERE notified_at IS NULL;

CREATE TABLE IF NOT EXISTS waitlist_email_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
  category_id UUID REFERENCES exam_categories(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_email_log_recent
  ON waitlist_email_log (email, sent_at DESC);
