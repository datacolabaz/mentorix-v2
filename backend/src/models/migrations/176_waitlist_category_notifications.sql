-- Waitlist v2: per-category subscriptions + notification tracking
-- Safe to re-run; uses gen_random_uuid() (no uuid-ossp extension required).

CREATE TABLE IF NOT EXISTS waitlist_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  category VARCHAR(32),
  category_slug VARCHAR(128),
  source VARCHAR(64) NOT NULL DEFAULT 'certified_catalog',
  category_id UUID,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE waitlist_notifications
  ADD COLUMN IF NOT EXISTS category_slug VARCHAR(128),
  ADD COLUMN IF NOT EXISTS category_id UUID,
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'exam_categories')
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'waitlist_notifications_category_id_fkey'
     ) THEN
    ALTER TABLE waitlist_notifications
      ADD CONSTRAINT waitlist_notifications_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES exam_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'exam_categories') THEN
    UPDATE waitlist_notifications w
    SET category_id = ec.id
    FROM exam_categories ec
    WHERE w.category_id IS NULL
      AND w.category_slug IS NOT NULL
      AND ec.slug = w.category_slug;
  END IF;
END $$;

ALTER TABLE waitlist_notifications DROP CONSTRAINT IF EXISTS waitlist_notifications_email_source_key;

DROP INDEX IF EXISTS waitlist_notifications_email_source_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email_category
  ON waitlist_notifications (email, category_id)
  WHERE category_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email_general
  ON waitlist_notifications (email)
  WHERE category_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_waitlist_pending_category
  ON waitlist_notifications (category_id, created_at DESC)
  WHERE notified_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_waitlist_notifications_created
  ON waitlist_notifications (created_at DESC);

CREATE TABLE IF NOT EXISTS waitlist_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  exam_id UUID,
  category_id UUID,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'exams')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'waitlist_email_log_exam_id_fkey') THEN
    ALTER TABLE waitlist_email_log
      ADD CONSTRAINT waitlist_email_log_exam_id_fkey
      FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'exam_categories')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'waitlist_email_log_category_id_fkey') THEN
    ALTER TABLE waitlist_email_log
      ADD CONSTRAINT waitlist_email_log_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES exam_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_waitlist_email_log_recent
  ON waitlist_email_log (email, sent_at DESC);
