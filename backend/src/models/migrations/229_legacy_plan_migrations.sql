-- Legacy 5 AZN STANDART ('pro') subscribers move to PROFESSIONAL ('growth', 10 AZN) at their NEXT
-- renewal, never mid-period, and only after an advance email + in-app notice (lead time 14 days).
-- Billing is manual (teacher-initiated card checkout or cash receipt approved by an admin); nothing
-- here charges anyone. One row per notified subscriber records the notice and the outcome:
--   notice_sent_at      when the email + in-app notice went out (NULL = notice not yet delivered)
--   effective_at        the earliest date a PROFESSIONAL renewal is required (= current period end)
--   pro_renewals_left   1 when the period ended less than 14 days after the first notice, so one more
--                       5 AZN monthly renewal is allowed and a fresh 14-day notice follows; else 0
--   applied_at          set when the teacher activates any non-legacy plan
-- Rollback (manual): backend/scripts/sql/rollback/229_legacy_plan_migrations.rollback.sql

SET LOCAL lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS legacy_plan_migrations (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  from_plan TEXT NOT NULL DEFAULT 'pro',
  to_plan TEXT NOT NULL DEFAULT 'growth',
  period_end_at_notice TIMESTAMPTZ,
  notice_sent_at TIMESTAMPTZ,
  effective_at TIMESTAMPTZ,
  pro_renewals_left INTEGER NOT NULL DEFAULT 0,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE legacy_plan_migrations DROP CONSTRAINT IF EXISTS legacy_plan_migrations_renewals_check;
ALTER TABLE legacy_plan_migrations
  ADD CONSTRAINT legacy_plan_migrations_renewals_check CHECK (pro_renewals_left BETWEEN 0 AND 1) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_legacy_plan_migrations_open
  ON legacy_plan_migrations (effective_at)
  WHERE applied_at IS NULL;

COMMENT ON TABLE legacy_plan_migrations IS
  'Legacy pro (5 AZN) -> growth (10 AZN) move at next renewal; advance notice tracking. No auto-charge.';
