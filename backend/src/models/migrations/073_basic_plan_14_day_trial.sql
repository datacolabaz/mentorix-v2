-- Convert legacy BASIC subscriptions with NULL period into 14-day trial.
-- Applies to instructors only.
-- Safe: paid upgrades already set current_period_end to 30 days; those are not NULL and will be skipped.

BEGIN;

UPDATE subscriptions s
SET
  current_period_start = COALESCE(s.current_period_start, NOW()),
  current_period_end = NOW() + interval '14 days',
  updated_at = NOW()
FROM users u
WHERE s.user_id = u.id
  AND u.role = 'instructor'
  AND u.is_active = TRUE
  AND LOWER(TRIM(COALESCE(s.plan, 'basic'))) = 'basic'
  AND (s.current_period_end IS NULL);

COMMIT;

