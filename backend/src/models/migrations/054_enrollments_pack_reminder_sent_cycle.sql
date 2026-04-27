-- Track idempotent pack payment reminders (8/12) per billing cycle.

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS pack_reminder_sent_cycle INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_enrollments_pack_reminder_sent_cycle
  ON enrollments (instructor_id, billing_type, billing_cycle, pack_reminder_sent_cycle);

