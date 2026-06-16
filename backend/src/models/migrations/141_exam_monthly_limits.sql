-- Aylıq imtahan limiti: admin paneldən idarə olunur (subscription_plans.exam_limit).

BEGIN;

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS exam_limit INT NULL;

UPDATE subscription_plans SET exam_limit = 2, updated_at = NOW() WHERE slug = 'basic';
UPDATE subscription_plans SET exam_limit = 20, updated_at = NOW() WHERE slug = 'pro';
UPDATE subscription_plans SET exam_limit = 50, updated_at = NOW() WHERE slug = 'growth';
UPDATE subscription_plans SET exam_limit = NULL, updated_at = NOW() WHERE slug = 'premium';

COMMIT;
