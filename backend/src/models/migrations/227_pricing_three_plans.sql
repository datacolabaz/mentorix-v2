-- Pricing: exactly three public plans.
--   basic   → "Pulsuz sınaq" (21 gün, 0 AZN)
--   growth  → PROFESSIONAL (10 AZN / ay)
--   premium → PREMIUM (19 AZN / ay)
-- The old 5 AZN STANDART plan (slug 'pro') is NOT deleted or migrated: existing subscribers keep it
-- (same limits, same renewal price). It is only hidden from the pricing page and from new purchases
-- (is_public = FALSE). Plan slugs stay the same, so subscriptions/payments need no data change.
-- SMS and internal live-video columns are deprecated (no longer read by the app), not dropped.
-- Rollback (manual): backend/scripts/sql/rollback/227_pricing_three_plans.rollback.sql

SET LOCAL lock_timeout = '10s';

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE subscription_plans
SET
  title = 'PULSUZ SINAQ',
  price_azn = 0,
  student_limit = 5,
  exam_limit = 3,
  homework_limit = 5,
  storage_gb = NULL,
  storage_limit_bytes = 1073741824,
  ai_question_limit = 20,
  ai_grading_limit = 10,
  features = '["5 iştirakçı","3 imtahan","5 tapşırıq","20 AI sual","10 AI ilə yoxlanılan açıq-cavab işi","1 GB bulud yaddaşı"]'::jsonb,
  marketing_features = '["Google Meet və Zoom linki ilə canlı dərs planlama","Məhdud e-poçt bildirişləri"]'::jsonb,
  plan_subtitle = 'Mentorix-in əsas imkanlarını 21 gün ödənişsiz yoxlayın.',
  plan_cta = 'Pulsuz başla',
  popular_label = NULL,
  highlight = FALSE,
  is_public = TRUE,
  updated_at = NOW()
WHERE slug = 'basic';

UPDATE subscription_plans
SET
  is_public = FALSE,
  highlight = FALSE,
  popular_label = NULL,
  updated_at = NOW()
WHERE slug = 'pro';

UPDATE subscription_plans
SET
  title = 'PROFESSIONAL',
  price_azn = 10,
  student_limit = 50,
  exam_limit = 50,
  homework_limit = 120,
  storage_gb = NULL,
  storage_limit_bytes = 21474836480,
  ai_question_limit = 300,
  ai_grading_limit = 100,
  features = '["50 tələbə","20 GB bulud yaddaşı","50 imtahan / ay","120 tapşırıq / ay","300 AI sual / ay","100 AI ilə yoxlanılan açıq-cavab işi / ay"]'::jsonb,
  marketing_features = '["Ödəniş izləmə","Valideyn e-poçt bildirişləri","Ətraflı hesabatlar","Qrup və fərdi çat","Google Meet və Zoom linkləri ilə limitsiz canlı dərs planlama","QR ilə doğrulana bilən sertifikat"]'::jsonb,
  plan_subtitle = 'Böyüyən qrupları idarə edən müəllimlər üçün.',
  plan_cta = 'Planı seç',
  popular_label = NULL,
  highlight = TRUE,
  is_public = TRUE,
  updated_at = NOW()
WHERE slug = 'growth';

UPDATE subscription_plans
SET
  title = 'PREMIUM',
  price_azn = 19,
  student_limit = NULL,
  exam_limit = NULL,
  homework_limit = NULL,
  storage_gb = NULL,
  storage_limit_bytes = 53687091200,
  ai_question_limit = 800,
  ai_grading_limit = 300,
  features = '["Limitsiz tələbə","50 GB bulud yaddaşı","Limitsiz imtahan","Limitsiz tapşırıq","800 AI sual / ay","300 AI ilə yoxlanılan açıq-cavab işi / ay"]'::jsonb,
  marketing_features = '["Ödəniş izləmə","Valideyn e-poçt bildirişləri","Ətraflı hesabatlar","Prioritet dəstək","Google Meet və Zoom linkləri ilə limitsiz canlı dərs planlama","QR ilə doğrulana bilən sertifikat"]'::jsonb,
  plan_subtitle = 'Aktiv müəllimlər və daha böyük tədris qrupları üçün.',
  plan_cta = 'Planı seç',
  popular_label = NULL,
  highlight = FALSE,
  is_public = TRUE,
  updated_at = NOW()
WHERE slug = 'premium';

COMMENT ON COLUMN subscription_plans.is_public IS
  'FALSE = legacy plan: existing subscribers keep it (limits + renewal), hidden from pricing page and new purchases.';
COMMENT ON COLUMN subscription_plans.sms_limit IS 'DEPRECATED: SMS retired. Not read by the app; drop per the later-drop plan.';
COMMENT ON COLUMN subscription_plans.recording_hours_monthly IS 'DEPRECATED: internal live video/recording retired.';
COMMENT ON COLUMN subscription_plans.recording_storage_bytes IS 'DEPRECATED: internal live video/recording retired.';
COMMENT ON COLUMN subscription_plans.recording_retention_days IS 'DEPRECATED: internal live video/recording retired.';
COMMENT ON COLUMN subscription_plans.recording_max_duration_sec IS 'DEPRECATED: internal live video/recording retired.';
COMMENT ON COLUMN subscription_plans.recording_max_quality IS 'DEPRECATED: internal live video/recording retired.';
