-- Billing: user-level → provider workspace köçürməsi üçün DRY-RUN.
-- YALNIZ OXUYUR. Heç bir cədvəl yaratmır, heç nəyi dəyişmir.
-- İşlətmək:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/scripts/sql/billing-workspace-dry-run.sql
-- Təhlükəsizlik üçün read-only tranzaksiyada işləyir:
BEGIN TRANSACTION READ ONLY;

\echo '== 1. Ümumi say: subscriptions, usage_counters, ödənişlər =='
SELECT
  (SELECT COUNT(*) FROM subscriptions)                                   AS subscriptions,
  (SELECT COUNT(*) FROM usage_counters)                                  AS usage_counters,
  (SELECT COUNT(*) FROM billing_payments)                                AS billing_payments,
  (SELECT COUNT(*) FROM billing_payments WHERE status = 'paid')          AS billing_payments_paid,
  (SELECT COUNT(*) FROM billing_history)                                 AS billing_history,
  (SELECT COUNT(*) FROM billing_events)                                  AS billing_events,
  (SELECT COUNT(*) FROM trials)                                          AS trials,
  (SELECT COUNT(*) FROM partner_commissions)                             AS partner_commissions;

\echo '== 2. Paket × status paylanması =='
SELECT LOWER(TRIM(COALESCE(s.plan, 'basic'))) AS plan, s.status, COUNT(*) AS n,
       COUNT(*) FILTER (WHERE s.pending_plan IS NOT NULL) AS with_pending_change,
       COUNT(*) FILTER (WHERE s.grace_until IS NOT NULL AND s.grace_until > NOW()) AS in_grace
FROM subscriptions s
GROUP BY 1, 2
ORDER BY 1, 2;

\echo '== 3. Hər subscription üçün hədəf workspace təsnifatı =='
-- target_kind:
--   provider_workspace  : aktiv müəllim, təşkilat sahibi deyil → fərdi provider workspace
--   org_workspace       : courses.owner_user_id → təşkilat (Center) workspace
--   orphan_user_missing : user silinib / tapılmır
--   orphan_not_provider : user müəllim deyil (tələbə/valideyn) və heç bir instructor rolu yoxdur
--   inactive_provider   : user deaktivdir və ya deleted_at doludur
WITH s AS (
  SELECT s.*, u.id AS uid, u.role, u.is_active, u.deleted_at,
         EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = s.user_id AND ur.role = 'instructor' AND ur.is_active) AS has_instructor_role,
         EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = s.user_id AND ur.role = 'student' AND ur.is_active)    AS has_student_role,
         EXISTS (SELECT 1 FROM courses c WHERE c.owner_user_id = s.user_id)                                            AS owns_org
  FROM subscriptions s
  LEFT JOIN users u ON u.id = s.user_id
)
SELECT
  CASE
    WHEN uid IS NULL THEN 'orphan_user_missing'
    WHEN is_active IS NOT TRUE OR deleted_at IS NOT NULL THEN 'inactive_provider'
    WHEN owns_org THEN 'org_workspace'
    WHEN role = 'instructor' OR has_instructor_role THEN 'provider_workspace'
    ELSE 'orphan_not_provider'
  END AS target_kind,
  COUNT(*) AS n,
  COUNT(*) FILTER (WHERE has_student_role) AS also_student,
  COUNT(*) FILTER (WHERE LOWER(COALESCE(plan, 'basic')) <> 'basic') AS paid_plans
FROM s
GROUP BY 1
ORDER BY 1;

\echo '== 4. Tam siyahı: user-level subscription-lar və təklif olunan hədəf =='
SELECT
  s.user_id,
  u.full_name,
  u.email,
  u.role AS primary_role,
  COALESCE((SELECT string_agg(ur.role, ',' ORDER BY ur.role) FROM user_roles ur WHERE ur.user_id = s.user_id AND ur.is_active), '') AS active_roles,
  LOWER(TRIM(COALESCE(s.plan, 'basic'))) AS plan,
  s.status,
  s.current_period_start,
  s.current_period_end,
  s.pending_plan,
  s.pending_effective_at,
  s.grace_until,
  (SELECT c.id FROM courses c WHERE c.owner_user_id = s.user_id LIMIT 1) AS owned_org_id,
  (SELECT COUNT(*) FROM course_teachers ct WHERE ct.instructor_user_id = s.user_id AND ct.is_active) AS teaches_in_orgs,
  CASE
    WHEN u.id IS NULL THEN 'orphan_user_missing'
    WHEN u.is_active IS NOT TRUE OR u.deleted_at IS NOT NULL THEN 'inactive_provider'
    WHEN EXISTS (SELECT 1 FROM courses c WHERE c.owner_user_id = s.user_id) THEN 'org_workspace'
    WHEN u.role = 'instructor' OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = s.user_id AND ur.role = 'instructor' AND ur.is_active) THEN 'provider_workspace'
    ELSE 'orphan_not_provider'
  END AS target_kind
FROM subscriptions s
LEFT JOIN users u ON u.id = s.user_id
ORDER BY target_kind, plan DESC, u.full_name NULLS LAST;

\echo '== 5. Subscription-u OLMAYAN provider-lər (köçürmədə basic workspace yaradılmalıdır) =='
SELECT u.id, u.full_name, u.email, u.role, u.created_at
FROM users u
WHERE u.is_active = TRUE AND u.deleted_at IS NULL
  AND (u.role = 'instructor' OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'instructor' AND ur.is_active))
  AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id)
ORDER BY u.created_at;

\echo '== 6. Eyni user üçün bir neçə potensial workspace (fərdi + təşkilat sahibi + başqa təşkilatda müəllim) =='
SELECT s.user_id, u.full_name,
       LOWER(COALESCE(s.plan, 'basic')) AS plan,
       EXISTS (SELECT 1 FROM courses c WHERE c.owner_user_id = s.user_id) AS owns_org,
       (SELECT COUNT(*) FROM course_teachers ct WHERE ct.instructor_user_id = s.user_id AND ct.is_active) AS teaches_in_orgs
FROM subscriptions s
JOIN users u ON u.id = s.user_id
WHERE EXISTS (SELECT 1 FROM courses c WHERE c.owner_user_id = s.user_id)
   OR (SELECT COUNT(*) FROM course_teachers ct WHERE ct.instructor_user_id = s.user_id AND ct.is_active) > 0
ORDER BY teaches_in_orgs DESC;

\echo '== 7. Həm tələbə, həm müəllim olan user-lər (entitlement qarışıqlığı riski) =='
SELECT s.user_id, u.full_name, u.role AS primary_role, LOWER(COALESCE(s.plan, 'basic')) AS plan, s.status,
       (SELECT COUNT(*) FROM enrollments e WHERE e.student_id = s.user_id AND e.deleted_at IS NULL) AS enrollments_as_student,
       (SELECT COUNT(*) FROM exam_results er WHERE er.student_id = s.user_id) AS exam_results_as_student
FROM subscriptions s
JOIN users u ON u.id = s.user_id
WHERE EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = s.user_id AND ur.role = 'student' AND ur.is_active)
   OR u.role = 'student'
ORDER BY enrollments_as_student DESC;

\echo '== 8. Dublikat / uyğunsuzluq riskləri =='
SELECT 'subscription_without_usage_counter' AS risk, COUNT(*) AS n
FROM subscriptions s WHERE NOT EXISTS (SELECT 1 FROM usage_counters uc WHERE uc.user_id = s.user_id)
UNION ALL
SELECT 'usage_counter_without_subscription', COUNT(*)
FROM usage_counters uc WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = uc.user_id)
UNION ALL
SELECT 'paid_plan_without_any_paid_payment', COUNT(*)
FROM subscriptions s
WHERE LOWER(COALESCE(s.plan, 'basic')) <> 'basic'
  AND NOT EXISTS (SELECT 1 FROM billing_payments bp WHERE bp.user_id = s.user_id AND bp.status = 'paid')
UNION ALL
SELECT 'multiple_pending_payments_same_user', COUNT(*)
FROM (SELECT user_id FROM billing_payments WHERE status = 'pending' GROUP BY user_id HAVING COUNT(*) > 1) x
UNION ALL
SELECT 'paid_payment_plan_differs_from_current_plan_last_30d', COUNT(*)
FROM billing_payments bp
JOIN subscriptions s ON s.user_id = bp.user_id
WHERE bp.status = 'paid' AND bp.product_type = 'plan'
  AND bp.paid_at > NOW() - interval '30 days'
  AND LOWER(bp.plan) <> LOWER(COALESCE(s.plan, 'basic'))
UNION ALL
SELECT 'org_owner_is_also_paying_individually', COUNT(*)
FROM courses c JOIN subscriptions s ON s.user_id = c.owner_user_id
WHERE LOWER(COALESCE(s.plan, 'basic')) <> 'basic'
UNION ALL
SELECT 'active_trial_and_paid_plan', COUNT(*)
FROM trials t JOIN subscriptions s ON s.user_id = t.user_id
WHERE t.is_active AND t.end_date > NOW() AND LOWER(COALESCE(s.plan, 'basic')) <> 'basic'
UNION ALL
SELECT 'partner_commission_on_orphan_payment', COUNT(*)
FROM partner_commissions pc
JOIN billing_payments bp ON bp.id = pc.billing_payment_id
LEFT JOIN users u ON u.id = bp.user_id
WHERE u.id IS NULL OR u.deleted_at IS NOT NULL;

\echo '== 9. Add-on balansları (usage_counters-dan workspace-ə daşınmalıdır) =='
SELECT COUNT(*) FILTER (WHERE extra_sms_balance > 0)   AS users_with_extra_sms,
       COALESCE(SUM(extra_sms_balance), 0)              AS total_extra_sms,
       COUNT(*) FILTER (WHERE extra_storage_bytes > 0) AS users_with_extra_storage,
       COALESCE(SUM(extra_storage_bytes), 0)            AS total_extra_storage_bytes
FROM usage_counters;

\echo '== 10. Ödəniş tarixçəsi həcmi (köçürülmür, workspace_id ilə etiketlənəcək) =='
SELECT status, product_type, COUNT(*) AS n, SUM(amount_cents) AS amount_cents
FROM billing_payments
GROUP BY 1, 2
ORDER BY 1, 2;

ROLLBACK;
