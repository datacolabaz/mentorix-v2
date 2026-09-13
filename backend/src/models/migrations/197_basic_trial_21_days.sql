-- Align SADƏ trial marketing copy to 21 days (product trial default).
-- Mid-trial users: existing subscriptions.current_period_end is NOT updated.
-- Only NEW grants use BASIC_TRIAL_DAYS / trial_duration_days (21).

BEGIN;

UPDATE subscription_plans
SET plan_subtitle = '21 günlük pulsuz sınaq',
    plan_cta = '21 günlük sınağa başla',
    updated_at = NOW()
WHERE slug = 'basic'
  AND (
    plan_subtitle ILIKE '%14%gün%'
    OR plan_cta ILIKE '%14%gün%'
    OR plan_subtitle IS NULL
    OR plan_cta IS NULL
  );

INSERT INTO billing_settings (key, value, updated_at)
VALUES ('trial_duration_days', '21', NOW())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW()
WHERE billing_settings.value IS DISTINCT FROM '21';

COMMIT;
