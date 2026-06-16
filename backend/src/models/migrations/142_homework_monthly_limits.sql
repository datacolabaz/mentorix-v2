-- Aylıq tapşırıq limiti: admin paneldən idarə olunur (subscription_plans.homework_limit).

BEGIN;

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS homework_limit INT NULL;

UPDATE subscription_plans SET homework_limit = 5, updated_at = NOW() WHERE slug = 'basic';
UPDATE subscription_plans SET homework_limit = 40, updated_at = NOW() WHERE slug = 'pro';
UPDATE subscription_plans SET homework_limit = 120, updated_at = NOW() WHERE slug = 'growth';
UPDATE subscription_plans SET homework_limit = NULL, updated_at = NOW() WHERE slug = 'premium';

COMMIT;
