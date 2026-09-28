-- Billing workspace köçürməsi üçün RECONCILIATION hesabatı.
-- YALNIZ OXUYUR. Köçürmədən ƏVVƏL və SONRA işlədin, çıxışları müqayisə edin.
-- Köçürmədən əvvəl: provider_workspaces cədvəli yoxdur → "after" bölməsi boş qayıdır.
-- İşlətmək:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/scripts/sql/billing-workspace-reconciliation.sql > recon-before.txt
BEGIN TRANSACTION READ ONLY;

\echo '== A. Mənbə (user-level) nəzarət cəmləri =='
SELECT
  COUNT(*)                                                               AS subscriptions_total,
  COUNT(*) FILTER (WHERE LOWER(COALESCE(plan, 'basic')) = 'basic')       AS plan_basic,
  COUNT(*) FILTER (WHERE LOWER(plan) = 'pro')                            AS plan_pro,
  COUNT(*) FILTER (WHERE LOWER(plan) = 'business')                       AS plan_business,
  COUNT(*) FILTER (WHERE status = 'active')                              AS status_active,
  COUNT(*) FILTER (WHERE status = 'past_due')                            AS status_past_due,
  COUNT(*) FILTER (WHERE pending_plan IS NOT NULL)                       AS pending_changes,
  md5(string_agg(user_id::text || ':' || LOWER(COALESCE(plan, 'basic')) || ':' || status
                 || ':' || COALESCE(current_period_end::text, ''), '|' ORDER BY user_id)) AS checksum
FROM subscriptions;

SELECT
  COALESCE(SUM(students_count), 0)       AS students_count_sum,
  COALESCE(SUM(sms_used_monthly), 0)     AS sms_used_sum,
  COALESCE(SUM(extra_sms_balance), 0)    AS extra_sms_sum,
  COALESCE(SUM(extra_storage_bytes), 0)  AS extra_storage_bytes_sum
FROM usage_counters;

SELECT
  COUNT(*)                                      AS payments_total,
  COUNT(*) FILTER (WHERE status = 'paid')       AS payments_paid,
  COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid'), 0) AS paid_amount_cents
FROM billing_payments;

\echo '== B. Hədəf (workspace-level) nəzarət cəmləri — yalnız köçürmədən sonra =='
DO $$
BEGIN
  IF to_regclass('public.provider_workspaces') IS NULL THEN
    RAISE NOTICE 'provider_workspaces hələ yoxdur — bu, köçürmədən ƏVVƏLKİ hesabatdır.';
  END IF;
END $$;

-- Köçürmədən sonra aşağıdakı sorğular A-dakı rəqəmlərlə eyni olmalıdır.
-- (Cədvəl yoxdursa, psql xəta verməsin deyə to_regclass yoxlaması ilə dinamik işləyir.)
SELECT
  CASE WHEN to_regclass('public.workspace_subscriptions') IS NULL THEN NULL
  ELSE (xpath('/row/n/text()', query_to_xml('SELECT COUNT(*) AS n FROM workspace_subscriptions', FALSE, TRUE, '')))[1]::text::int
  END AS workspace_subscriptions_total,
  CASE WHEN to_regclass('public.workspace_subscriptions') IS NULL THEN NULL
  ELSE (xpath('/row/n/text()', query_to_xml(
    $q$SELECT md5(string_agg(legacy_user_id::text || ':' || LOWER(plan) || ':' || status || ':' || COALESCE(current_period_end::text, ''), '|' ORDER BY legacy_user_id)) AS n
       FROM workspace_subscriptions WHERE legacy_user_id IS NOT NULL$q$, FALSE, TRUE, '')))[1]::text
  END AS workspace_checksum,
  CASE WHEN to_regclass('public.billing_payments') IS NULL OR NOT EXISTS (
         SELECT 1 FROM information_schema.columns WHERE table_name = 'billing_payments' AND column_name = 'workspace_id')
  THEN NULL
  ELSE (xpath('/row/n/text()', query_to_xml('SELECT COUNT(*) AS n FROM billing_payments WHERE workspace_id IS NULL', FALSE, TRUE, '')))[1]::text::int
  END AS payments_without_workspace;

\echo '== C. Gözlənilən nəticə =='
\echo 'subscriptions_total = workspace_subscriptions_total'
\echo 'checksum = workspace_checksum (plan, status, period_end user üzrə eynidir)'
\echo 'payments_without_workspace = 0'

ROLLBACK;
