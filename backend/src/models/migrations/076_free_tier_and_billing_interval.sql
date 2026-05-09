BEGIN;

ALTER TABLE billing_payments
  ADD COLUMN IF NOT EXISTS billing_interval TEXT NOT NULL DEFAULT 'monthly';

-- Free tier defaults (editable in Admin → plans). No subscription end date logic for BASIC — usage gates only.
UPDATE subscription_plans
SET
  title = 'SADƏ',
  price_azn = 0,
  student_limit = 5,
  sms_limit = 5,
  storage_gb = (512::numeric / (1024 * 1024 * 1024)),
  features = jsonb_build_array('Limitlər idarə panelindən yenilənir'),
  highlight = FALSE,
  updated_at = NOW()
WHERE slug = 'basic';

UPDATE subscription_plans SET title = 'PRO', updated_at = NOW() WHERE slug = 'pro';
UPDATE subscription_plans SET title = 'BİZNES', updated_at = NOW() WHERE slug = 'business';

UPDATE subscriptions s
SET
  status = 'active',
  current_period_end = NULL,
  grace_until = NULL,
  updated_at = NOW()
FROM users u
WHERE s.user_id = u.id
  AND u.role = 'instructor'
  AND u.is_active = TRUE
  AND LOWER(TRIM(COALESCE(s.plan, 'basic'))) = 'basic';

COMMIT;
