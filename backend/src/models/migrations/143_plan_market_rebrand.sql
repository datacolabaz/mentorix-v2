-- Başlanğıc / Standart / Professional / Premium — yeni bazar qiymətləri və limitlər.

BEGIN;

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS document_limit INT NULL;

UPDATE subscription_plans
SET
  title = 'Başlanğıc',
  price_azn = 0,
  student_limit = 5,
  document_limit = 50,
  storage_gb = NULL,
  storage_limit_bytes = 5242880,
  sms_limit = 5,
  exam_limit = 2,
  homework_limit = 5,
  highlight = FALSE,
  features = '["5 tələbə","50 sənəd","5 SMS","2 imtahan / ay","5 tapşırıq / ay"]'::jsonb,
  updated_at = NOW()
WHERE slug = 'basic';

UPDATE subscription_plans
SET
  title = 'Standart',
  price_azn = 5,
  student_limit = 20,
  document_limit = 1250,
  storage_gb = NULL,
  storage_limit_bytes = 134217728,
  sms_limit = 20,
  exam_limit = 20,
  homework_limit = 40,
  highlight = TRUE,
  features = '["20 tələbə","1 250 sənəd","20 SMS / ay","20 imtahan / ay","40 tapşırıq / ay"]'::jsonb,
  updated_at = NOW()
WHERE slug = 'pro';

UPDATE subscription_plans
SET
  title = 'Professional',
  price_azn = 10,
  student_limit = 50,
  document_limit = 5000,
  storage_gb = NULL,
  storage_limit_bytes = 536870912,
  sms_limit = 50,
  exam_limit = 50,
  homework_limit = 120,
  highlight = FALSE,
  features = '["50 tələbə","5 000 sənəd","50 SMS / ay","50 imtahan / ay","120 tapşırıq / ay"]'::jsonb,
  updated_at = NOW()
WHERE slug = 'growth';

UPDATE subscription_plans
SET
  title = 'Premium',
  price_azn = 19,
  student_limit = NULL,
  document_limit = NULL,
  storage_gb = NULL,
  storage_limit_bytes = NULL,
  sms_limit = 200,
  exam_limit = NULL,
  homework_limit = NULL,
  highlight = FALSE,
  features = '["Limitsiz tələbə","Limitsiz sənəd","200 SMS / ay","Limitsiz imtahan / ay","Limitsiz tapşırıq / ay"]'::jsonb,
  updated_at = NOW()
WHERE slug = 'premium';

COMMIT;
