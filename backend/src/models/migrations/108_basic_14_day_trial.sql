-- SADƏ paket: 14 günlük sınaq (sonsuz NULL period_end ləğv)

BEGIN;

UPDATE subscriptions s
SET
  current_period_start = COALESCE(s.current_period_start, NOW()),
  current_period_end = COALESCE(s.current_period_start, NOW()) + interval '14 days',
  status = 'active',
  updated_at = NOW()
FROM users u
WHERE s.user_id = u.id
  AND u.role = 'instructor'
  AND u.is_active = TRUE
  AND LOWER(TRIM(COALESCE(s.plan, 'basic'))) = 'basic'
  AND s.current_period_end IS NULL;

COMMIT;
