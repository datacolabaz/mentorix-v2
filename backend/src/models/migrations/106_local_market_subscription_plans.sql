-- Lokal bazar: SADƏ / PRO / GROWTH / PREMIUM (business → premium)

BEGIN;

UPDATE subscription_plans
SET
  title = 'SADƏ',
  price_azn = 0,
  student_limit = 5,
  sms_limit = 5,
  storage_gb = NULL,
  storage_limit_bytes = 5242880,
  features = '["5 tələbə","5 SMS / ay","5 MB Sənəd Yaddaşı"]'::jsonb,
  highlight = FALSE,
  is_active = TRUE,
  updated_at = NOW()
WHERE slug = 'basic';

UPDATE subscription_plans
SET
  title = 'PRO',
  price_azn = 10,
  student_limit = 50,
  sms_limit = 50,
  storage_gb = NULL,
  storage_limit_bytes = 268435456,
  features = '["50 tələbə","50 SMS / ay","256 MB Sənəd Yaddaşı"]'::jsonb,
  highlight = TRUE,
  is_active = TRUE,
  updated_at = NOW()
WHERE slug = 'pro';

INSERT INTO subscription_plans (slug, title, price_azn, student_limit, storage_gb, storage_limit_bytes, sms_limit, ram_limit_mb, features, highlight, is_active)
VALUES (
  'growth',
  'GROWTH',
  20,
  100,
  NULL,
  1073741824,
  100,
  NULL,
  '["100 tələbə","100 SMS / ay","1 GB Sənəd Yaddaşı"]'::jsonb,
  FALSE,
  TRUE
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  price_azn = EXCLUDED.price_azn,
  student_limit = EXCLUDED.student_limit,
  storage_gb = EXCLUDED.storage_gb,
  storage_limit_bytes = EXCLUDED.storage_limit_bytes,
  sms_limit = EXCLUDED.sms_limit,
  features = EXCLUDED.features,
  highlight = EXCLUDED.highlight,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

INSERT INTO subscription_plans (slug, title, price_azn, student_limit, storage_gb, storage_limit_bytes, sms_limit, ram_limit_mb, features, highlight, is_active)
VALUES (
  'premium',
  'PREMIUM',
  30,
  NULL,
  NULL,
  2147483648,
  200,
  NULL,
  '["Limitsiz tələbə","200 SMS / Əlavə balans imkanı","2 GB Sənəd Yaddaşı"]'::jsonb,
  FALSE,
  TRUE
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  price_azn = EXCLUDED.price_azn,
  student_limit = EXCLUDED.student_limit,
  storage_gb = EXCLUDED.storage_gb,
  storage_limit_bytes = EXCLUDED.storage_limit_bytes,
  sms_limit = EXCLUDED.sms_limit,
  features = EXCLUDED.features,
  highlight = EXCLUDED.highlight,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

UPDATE subscription_plans SET is_active = FALSE, updated_at = NOW() WHERE slug = 'business';

UPDATE subscriptions SET plan = 'premium', updated_at = NOW()
WHERE LOWER(TRIM(COALESCE(plan, ''))) IN ('business', 'biznes', 'bİznes');

UPDATE billing_payments SET plan = 'premium'
WHERE LOWER(TRIM(COALESCE(plan, ''))) IN ('business', 'biznes');

COMMIT;
