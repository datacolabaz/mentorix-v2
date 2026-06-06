const db = require('../utils/db');
const { ACTIVE_ENROLLMENT_JOIN_INLINE } = require('../sql/activeEnrollments');

function monthStartSql() {
  return `date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')`;
}

function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function roundPct(n) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  return Math.round(Number(n) * 10) / 10;
}

async function getFinancialMetrics() {
  const { rows } = await db.query(
    `WITH paid_subs AS (
       SELECT
         s.user_id,
         s.status,
         s.updated_at,
         sp.price_azn,
         COALESCE(bp.billing_interval, 'monthly') AS billing_interval
       FROM subscriptions s
       JOIN users u ON u.id = s.user_id
         AND u.role = 'instructor'
         AND u.is_active = TRUE
         AND u.deleted_at IS NULL
       JOIN subscription_plans sp ON sp.slug = COALESCE(NULLIF(TRIM(s.plan), ''), 'basic') AND sp.is_active = TRUE
       LEFT JOIN LATERAL (
         SELECT COALESCE(NULLIF(TRIM(billing_interval), ''), 'monthly') AS billing_interval
         FROM billing_payments bp
         WHERE bp.user_id = s.user_id
           AND LOWER(TRIM(COALESCE(bp.status, ''))) = 'paid'
           AND COALESCE(bp.product_type, 'plan') = 'plan'
         ORDER BY COALESCE(bp.paid_at, bp.created_at) DESC NULLS LAST
         LIMIT 1
       ) bp ON TRUE
       WHERE COALESCE(sp.price_azn, 0) > 0
     )
     SELECT
       COALESCE(SUM(
         CASE WHEN LOWER(TRIM(COALESCE(status, ''))) IN ('active', 'grace')
           THEN CASE WHEN billing_interval = 'yearly' THEN price_azn / 12.0 ELSE price_azn END
           ELSE 0 END
       ), 0)::numeric AS mrr_azn,
       COUNT(*) FILTER (
         WHERE LOWER(TRIM(COALESCE(status, ''))) IN ('active', 'grace')
       )::int AS active_paid_instructors,
       COUNT(*) FILTER (
         WHERE LOWER(TRIM(COALESCE(status, ''))) IN ('expired', 'cancelled', 'blocked')
           AND updated_at >= ${monthStartSql()}
       )::int AS churned_this_month,
       (
         SELECT COALESCE(SUM(amount_cents), 0)::numeric / 100.0
         FROM billing_payments
         WHERE LOWER(TRIM(COALESCE(status, ''))) = 'paid'
           AND COALESCE(product_type, 'plan') = 'sms'
           AND COALESCE(paid_at, created_at) >= ${monthStartSql()}
       ) AS addon_sms_revenue_azn`,
  );

  const r = rows[0] || {};
  const activePaid = Number(r.active_paid_instructors) || 0;
  const churned = Number(r.churned_this_month) || 0;
  const churnBase = activePaid + churned;
  const churnRatePct = churnBase > 0 ? roundPct((churned / churnBase) * 100) : churned > 0 ? 100 : 0;

  return {
    mrr_azn: roundMoney(r.mrr_azn),
    churn_rate_pct: churnRatePct,
    churned_instructors_this_month: churned,
    active_paid_instructors: activePaid,
    addon_sms_revenue_azn: roundMoney(r.addon_sms_revenue_azn),
  };
}

async function getHotLeadInstructors({ smsThreshold = 85, storageThreshold = 90, limit = 25 } = {}) {
  const { rows } = await db.query(
    `SELECT
       u.id,
       u.full_name,
       u.email,
       u.phone,
       COALESCE(s.plan, 'basic') AS plan,
       GREATEST(COALESCE(uc.sms_used_monthly, 0), 0)::int AS sms_used,
       (COALESCE(sp.sms_limit, 0) + COALESCE(uc.extra_sms_balance, 0))::int AS sms_cap,
       COALESCE(uc.storage_used_bytes, 0)::bigint AS storage_used_bytes,
       (
         COALESCE(
           sp.storage_limit_bytes,
           CASE WHEN sp.storage_gb IS NOT NULL THEN (sp.storage_gb * 1024 * 1024)::bigint ELSE NULL END
         )
         + COALESCE(uc.extra_storage_bytes, 0)
       )::bigint AS storage_cap_bytes
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     LEFT JOIN usage_counters uc ON uc.user_id = u.id
     LEFT JOIN subscription_plans sp ON sp.slug = COALESCE(s.plan, 'basic') AND sp.is_active = TRUE
     WHERE u.role = 'instructor' AND u.is_active = TRUE AND u.deleted_at IS NULL
     ORDER BY u.full_name
     LIMIT 500`,
  );

  const out = [];
  for (const r of rows || []) {
    const smsCap = r.sms_cap != null ? Number(r.sms_cap) : null;
    const smsUsed = Number(r.sms_used) || 0;
    const stCap = r.storage_cap_bytes != null ? Number(r.storage_cap_bytes) : null;
    const stUsed = Number(r.storage_used_bytes) || 0;
    const smsPct = smsCap != null && smsCap > 0 ? Math.round((smsUsed / smsCap) * 100) : null;
    const stPct = stCap != null && stCap > 0 ? Math.round((stUsed / stCap) * 100) : null;
    const smsAlert = smsPct != null && smsPct >= smsThreshold;
    const storageAlert = stPct != null && stPct >= storageThreshold;
    if (!smsAlert && !storageAlert) continue;

    const alerts = [];
    if (smsAlert) alerts.push('sms');
    if (storageAlert) alerts.push('storage');

    out.push({
      id: r.id,
      full_name: r.full_name,
      email: r.email,
      phone: r.phone,
      plan: r.plan,
      sms_used: smsUsed,
      sms_cap: smsCap,
      sms_pct: smsPct,
      storage_used_mb: Math.round(stUsed / (1024 * 1024)),
      storage_cap_mb: stCap != null ? Math.round(stCap / (1024 * 1024)) : null,
      storage_pct: stPct,
      alerts,
      top_pct: Math.max(smsPct || 0, stPct || 0),
    });
  }

  out.sort((a, b) => b.top_pct - a.top_pct);
  return out.slice(0, limit);
}

async function getEngagementMetrics() {
  const { rows } = await db.query(
    `WITH marked AS (
       SELECT
         CASE WHEN el.status = 'done' THEN 1 ELSE 0 END AS present,
         CASE WHEN el.status = 'absent' THEN 1 ELSE 0 END AS absent
       FROM enrollment_lessons el
       JOIN enrollments e ON e.id = el.enrollment_id
       ${ACTIVE_ENROLLMENT_JOIN_INLINE}
         AND el.starts_at >= ${monthStartSql()}
         AND el.status IN ('done', 'absent')

       UNION ALL

       SELECT
         CASE WHEN mas.status = 'attended' THEN 1 ELSE 0 END AS present,
         CASE WHEN mas.status = 'absent' THEN 1 ELSE 0 END AS absent
       FROM monthly_attendance_slots mas
       JOIN enrollments e ON e.id = mas.enrollment_id
       ${ACTIVE_ENROLLMENT_JOIN_INLINE}
         AND mas.lesson_date >= (${monthStartSql()})::date
         AND mas.status IN ('attended', 'absent')
     ),
     att AS (
       SELECT
         COALESCE(SUM(present), 0)::int AS present_n,
         COALESCE(SUM(present) + SUM(absent), 0)::int AS decided_n
       FROM marked
     )
     SELECT
       (
         SELECT COUNT(*)::int FROM exams e
         WHERE COALESCE(e.is_deleted, FALSE) = FALSE
           AND e.participant_group_id IS NOT NULL
           AND e.created_at >= ${monthStartSql()}
       ) AS otk_exams_this_month,
       (
         SELECT COUNT(DISTINCT er.student_id)::int
         FROM exam_results er
         JOIN exams ex ON ex.id = er.exam_id AND COALESCE(ex.is_deleted, FALSE) = FALSE
         WHERE COALESCE(er.started_at, er.submitted_at) >= ${monthStartSql()}
       ) AS active_quiz_participants,
       (
         SELECT CASE WHEN att.decided_n > 0
           THEN ROUND(100.0 * att.present_n / NULLIF(att.decided_n, 0), 1)
           ELSE NULL END
         FROM att
       ) AS avg_attendance_rate_pct`,
  );

  const r = rows[0] || {};
  return {
    otk_exams_this_month: Number(r.otk_exams_this_month) || 0,
    active_quiz_participants: Number(r.active_quiz_participants) || 0,
    avg_attendance_rate_pct:
      r.avg_attendance_rate_pct != null ? roundPct(r.avg_attendance_rate_pct) : null,
  };
}

async function getAdminPlatformHealth() {
  const [financial, hot_leads, engagement] = await Promise.all([
    getFinancialMetrics(),
    getHotLeadInstructors(),
    getEngagementMetrics(),
  ]);

  return {
    financial,
    hot_leads,
    engagement,
    thresholds: { sms_alert_pct: 85, storage_alert_pct: 90 },
  };
}

module.exports = {
  getAdminPlatformHealth,
  getFinancialMetrics,
  getHotLeadInstructors,
  getEngagementMetrics,
};
