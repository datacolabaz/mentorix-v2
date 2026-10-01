-- MANUAL rollback for migration 227_pricing_three_plans.sql.
-- This folder is NOT read by scripts/migrate.js. Never copy this file into src/models/migrations/.
--
-- Restores the pre-227 plan rows (values from migrations 143/145/196/197/202) and drops is_public.
-- Subscriptions are not touched (227 never changed them).
--
-- Usage (non-production first):  psql "$DATABASE_URL" -f backend/scripts/sql/rollback/227_pricing_three_plans.rollback.sql

BEGIN;

SET LOCAL lock_timeout = '10s';

UPDATE subscription_plans
SET title = 'SADƏ', exam_limit = 2, storage_limit_bytes = 5242880,
    features = '["5 tələbə","50 sənəd","5 SMS","2 imtahan / ay","5 tapşırıq / ay"]'::jsonb,
    marketing_features = '["Ödəniş izləmə","Valideyn bildirişləri","Xəritədə görünmə"]'::jsonb,
    plan_subtitle = '21 günlük pulsuz sınaq', plan_cta = '21 günlük sınağa başla', highlight = FALSE,
    updated_at = NOW()
WHERE slug = 'basic';

UPDATE subscription_plans
SET highlight = TRUE, popular_label = '⭐ Ən populyar', updated_at = NOW()
WHERE slug = 'pro';

UPDATE subscription_plans
SET storage_limit_bytes = 536870912,
    features = '["50 tələbə","5 000 sənəd","50 SMS / ay","50 imtahan / ay","120 tapşırıq / ay"]'::jsonb,
    marketing_features = '["Ödəniş izləmə","Valideyn bildirişləri","Xəritədə görünmə","Ətraflı hesabatlar"]'::jsonb,
    plan_subtitle = NULL, plan_cta = 'Professional seç', highlight = FALSE, updated_at = NOW()
WHERE slug = 'growth';

UPDATE subscription_plans
SET storage_limit_bytes = NULL,
    features = '["Limitsiz tələbə","Limitsiz sənəd","200 SMS / ay","Limitsiz imtahan / ay","Limitsiz tapşırıq / ay"]'::jsonb,
    marketing_features = '["Ödəniş izləmə","Valideyn bildirişləri","Xəritədə görünmə","Ətraflı hesabatlar","Prioritet texniki dəstək"]'::jsonb,
    plan_subtitle = NULL, plan_cta = 'Premium seç', highlight = FALSE, updated_at = NOW()
WHERE slug = 'premium';

ALTER TABLE subscription_plans DROP COLUMN IF EXISTS is_public;

COMMENT ON COLUMN subscription_plans.sms_limit IS NULL;
COMMENT ON COLUMN subscription_plans.recording_hours_monthly IS NULL;
COMMENT ON COLUMN subscription_plans.recording_storage_bytes IS NULL;
COMMENT ON COLUMN subscription_plans.recording_retention_days IS NULL;
COMMENT ON COLUMN subscription_plans.recording_max_duration_sec IS NULL;
COMMENT ON COLUMN subscription_plans.recording_max_quality IS NULL;

DELETE FROM schema_migrations WHERE filename = '227_pricing_three_plans.sql';

COMMIT;
