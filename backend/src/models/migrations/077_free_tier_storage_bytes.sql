-- Byte-accurate storage cap for free tier (512 KB). Numeric storage_gb ceilings collapse tiny limits to 1 MB.

BEGIN;

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS storage_limit_bytes BIGINT NULL;

ALTER TABLE usage_counters
  ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT NOT NULL DEFAULT 0;

UPDATE subscription_plans
SET
  title = 'SADƏ',
  price_azn = 0,
  student_limit = 5,
  sms_limit = 5,
  storage_gb = NULL,
  storage_limit_bytes = 524288,
  features = jsonb_build_array(
    '5 tələbə',
    '5 SMS / ay',
    '512 KB yaddaş'
  ),
  updated_at = NOW()
WHERE slug = 'basic';

-- Keep paid plans on GB-based caps (storage_limit_bytes stays NULL).

UPDATE usage_counters uc
SET storage_used_bytes = GREATEST(0, COALESCE(ip.storage_used_bytes, 0))
FROM instructor_profiles ip
WHERE ip.user_id = uc.user_id;

COMMIT;
