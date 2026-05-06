-- Backfill instructor subscriptions.plan from legacy trials limits.
-- Goal: move existing instructors onto package-based entitlements (subscription_plans).
--
-- Strategy:
-- - If an instructor already has a subscriptions row, keep it.
-- - Else, if they have a trials row with limits, pick the smallest active plan that satisfies those limits.
-- - Otherwise default to 'basic'.
-- - Finally, deactivate any legacy trial row (plan becomes source of truth for limits).

BEGIN;

-- Ensure subscriptions row exists for all instructors.
INSERT INTO subscriptions (user_id, plan, status)
SELECT u.id, 'basic', 'active'
FROM users u
WHERE u.role = 'instructor'
  AND u.is_active = TRUE
ON CONFLICT (user_id) DO NOTHING;

-- For instructors who were previously on legacy trials, infer the closest plan.
-- We choose the minimal plan that meets (max_students, storage_limit_mb, sms_limit_monthly).
WITH ins AS (
  SELECT
    u.id AS user_id,
    COALESCE(t.max_students, 0) AS need_students,
    COALESCE(t.storage_limit_mb, 0) AS need_storage_mb,
    COALESCE(t.sms_limit_monthly, 0) AS need_sms
  FROM users u
  JOIN trials t ON t.user_id = u.id
  WHERE u.role = 'instructor'
    AND u.is_active = TRUE
),
candidate AS (
  SELECT
    ins.user_id,
    sp.slug,
    -- Plan satisfies if it is unlimited (NULL) or >= needed for each dimension.
    (
      (sp.student_limit IS NULL OR sp.student_limit >= ins.need_students)
      AND (sp.storage_gb IS NULL OR (sp.storage_gb * 1024) >= ins.need_storage_mb)
      AND (sp.sms_limit IS NULL OR sp.sms_limit >= ins.need_sms)
    ) AS ok,
    -- Rank by "smallest" plan: basic < pro < business < others
    CASE
      WHEN sp.slug = 'basic' THEN 1
      WHEN sp.slug = 'pro' THEN 2
      WHEN sp.slug = 'business' THEN 3
      ELSE 100
    END AS rank
  FROM ins
  JOIN subscription_plans sp ON sp.is_active = TRUE
)
UPDATE subscriptions s
SET plan = COALESCE((
  SELECT c.slug
  FROM candidate c
  WHERE c.user_id = s.user_id AND c.ok = TRUE
  ORDER BY c.rank ASC
  LIMIT 1
), s.plan),
    status = 'active'
WHERE s.user_id IN (SELECT user_id FROM ins);

-- Deactivate legacy trials for instructors (plan-driven limits only).
UPDATE trials
SET is_active = FALSE
WHERE user_id IN (SELECT id FROM users WHERE role = 'instructor')
  AND is_active = TRUE;

COMMIT;

