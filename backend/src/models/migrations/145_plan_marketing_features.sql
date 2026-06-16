-- Paket kartlarında göstərilən platforma imkanları (admin paneldən idarə olunur).

BEGIN;

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS marketing_features JSONB NULL,
  ADD COLUMN IF NOT EXISTS plan_subtitle TEXT NULL,
  ADD COLUMN IF NOT EXISTS plan_cta TEXT NULL,
  ADD COLUMN IF NOT EXISTS popular_label TEXT NULL;

UPDATE subscription_plans
SET
  marketing_features = '["Ödəniş izləmə","Valideyn bildirişləri","Xəritədə görünmə"]'::jsonb,
  plan_subtitle = '14 günlük pulsuz sınaq',
  plan_cta = '14 günlük sınağa başla',
  popular_label = NULL,
  updated_at = NOW()
WHERE slug = 'basic';

UPDATE subscription_plans
SET
  marketing_features = '["Ödəniş izləmə","Valideyn bildirişləri","Xəritədə görünmə"]'::jsonb,
  plan_subtitle = NULL,
  plan_cta = 'Standart seç',
  popular_label = '⭐ Ən populyar',
  updated_at = NOW()
WHERE slug = 'pro';

UPDATE subscription_plans
SET
  marketing_features = '["Ödəniş izləmə","Valideyn bildirişləri","Xəritədə görünmə","Ətraflı hesabatlar"]'::jsonb,
  plan_subtitle = NULL,
  plan_cta = 'Professional seç',
  popular_label = NULL,
  updated_at = NOW()
WHERE slug = 'growth';

UPDATE subscription_plans
SET
  marketing_features = '["Ödəniş izləmə","Valideyn bildirişləri","Xəritədə görünmə","Ətraflı hesabatlar","Prioritet texniki dəstək"]'::jsonb,
  plan_subtitle = NULL,
  plan_cta = 'Premium seç',
  popular_label = NULL,
  updated_at = NOW()
WHERE slug = 'premium';

COMMIT;
