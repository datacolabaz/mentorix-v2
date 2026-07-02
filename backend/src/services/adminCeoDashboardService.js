const db = require('../utils/db');
const { getOnlinePresenceStats } = require('./accessEventService');
const { getFinancialMetrics } = require('./adminPlatformHealthService');

const REFRESH_SECONDS = 30;

function bakuTodaySql() {
  return `(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date`;
}

function roundPct(n) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  return Math.round(Number(n) * 10) / 10;
}

function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

async function countSafe(query, params = []) {
  try {
    const { rows } = await db.query(query, params);
    return Number(rows[0]?.count) || 0;
  } catch (e) {
    if (e?.code === '42P01') return 0;
    throw e;
  }
}

async function getTodayConversionPct() {
  try {
    const { rows } = await db.query(
      `SELECT
         (SELECT COUNT(DISTINCT COALESCE(e.session_key, e.id::text))::int
          FROM access_events e
          WHERE (e.created_at AT TIME ZONE 'Asia/Baku')::date = ${bakuTodaySql()}
            AND e.event_type IN ('page_view', 'landing_view')) AS unique_visitors,
         (SELECT COUNT(*)::int FROM users u
          WHERE u.deleted_at IS NULL
            AND (u.created_at AT TIME ZONE 'Asia/Baku')::date = ${bakuTodaySql()}) AS registrations`,
    );
    const uv = Number(rows[0]?.unique_visitors) || 0;
    const regs = Number(rows[0]?.registrations) || 0;
    if (uv <= 0) return regs > 0 ? null : 0;
    return roundPct(Math.min(100, (regs / uv) * 100));
  } catch (e) {
    if (e?.code === '42P01') return null;
    throw e;
  }
}

async function getPendingActions() {
  const [
    instructorDiscover,
    billingPayments,
    marketplaceInquiries,
    universityPrograms,
    instructorLimitAlerts,
  ] = await Promise.all([
    countSafe(
      `SELECT COUNT(*)::int AS count
       FROM instructor_profiles ip
       JOIN users u ON u.id = ip.user_id
         AND u.role = 'instructor'
         AND u.is_active = TRUE
         AND u.deleted_at IS NULL
       WHERE ip.discover_verified = FALSE
         AND (
           COALESCE(ip.map_visible, FALSE) = TRUE
           OR NULLIF(TRIM(COALESCE(ip.discover_bio, '')), '') IS NOT NULL
         )`,
    ),
    countSafe(
      `SELECT COUNT(*)::int AS count
       FROM billing_payments
       WHERE LOWER(TRIM(COALESCE(status, ''))) = 'pending'
         AND LOWER(TRIM(COALESCE(payment_method, ''))) = 'cash'`,
    ),
    countSafe(
      `SELECT COUNT(*)::int AS count
       FROM student_inquiries
       WHERE LOWER(TRIM(COALESCE(status, ''))) = 'pending'
         AND created_at >= NOW() - INTERVAL '30 days'`,
    ),
    countSafe(
      `SELECT COUNT(*)::int AS count
       FROM university_program_contributions
       WHERE LOWER(TRIM(COALESCE(status, ''))) = 'pending'`,
    ),
    countSafe(
      `SELECT COUNT(DISTINCT u.id)::int AS count
       FROM users u
       JOIN instructor_profiles ip ON ip.user_id = u.id
       LEFT JOIN usage_counters uc ON uc.user_id = u.id
       LEFT JOIN subscriptions s ON s.user_id = u.id
       LEFT JOIN subscription_plans sp ON sp.slug = COALESCE(NULLIF(TRIM(s.plan), ''), 'basic')
       WHERE u.role = 'instructor'
         AND u.is_active = TRUE
         AND u.deleted_at IS NULL
         AND (
           (COALESCE(sp.sms_limit, 0) + COALESCE(uc.extra_sms_balance, 0)) > 0
           AND (COALESCE(uc.sms_used_monthly, 0)::float / NULLIF(COALESCE(sp.sms_limit, 0) + COALESCE(uc.extra_sms_balance, 0), 0)) >= 0.85
         )`,
    ),
  ]);

  const items = [
    {
      key: 'instructor_discover_verify',
      label: 'Təsdiq gözləyən müəllim profilləri',
      description: 'Axtarışda görünmək üçün verify gözləyən müəllimlər',
      count: instructorDiscover,
      href: '/admin/instructors',
      severity: instructorDiscover > 0 ? 'warning' : 'info',
    },
    {
      key: 'billing_payment_pending',
      label: 'Ödəniş təsdiqləri',
      description: 'Nağd/köçürmə ilə gözləyən platform ödənişləri',
      count: billingPayments,
      href: '/admin/billing',
      severity: billingPayments > 0 ? 'critical' : 'info',
    },
    {
      key: 'marketplace_inquiries',
      label: 'Yeni marketplace müraciətləri',
      description: 'Son 30 gündə cavab gözləyən dərs sorğuları',
      count: marketplaceInquiries,
      href: '/admin/instructors',
      severity: marketplaceInquiries > 0 ? 'warning' : 'info',
    },
    {
      key: 'university_program_pending',
      label: 'Universitet proqram təsdiqləri',
      description: 'Moderasiya gözləyən proqram töhfələri',
      count: universityPrograms,
      href: '/admin/university-programs',
      severity: universityPrograms > 0 ? 'warning' : 'info',
    },
    {
      key: 'instructor_limit_alerts',
      label: 'Limit xəbərdarlıqları (SMS)',
      description: 'SMS limiti ≥85% olan müəllimlər',
      count: instructorLimitAlerts,
      href: '/admin/notifications',
      severity: instructorLimitAlerts > 0 ? 'warning' : 'info',
    },
  ];

  const pending_total = items.reduce((sum, i) => sum + i.count, 0);
  return { items, pending_total };
}

async function getCeoDashboard() {
  const today = bakuTodaySql();

  const [
    newStudentsToday,
    newInstructorsToday,
    financial,
    online,
    conversionPct,
    pending,
    recentToday,
  ] = await Promise.all([
    countSafe(
      `SELECT COUNT(*)::int AS count FROM users
       WHERE role = 'student' AND deleted_at IS NULL
         AND (created_at AT TIME ZONE 'Asia/Baku')::date = ${today}`,
    ),
    countSafe(
      `SELECT COUNT(*)::int AS count FROM users
       WHERE role = 'instructor' AND deleted_at IS NULL AND is_active = TRUE
         AND (created_at AT TIME ZONE 'Asia/Baku')::date = ${today}`,
    ),
    getFinancialMetrics().catch(() => ({
      mrr_azn: 0,
      active_paid_instructors: 0,
      churn_rate_pct: null,
    })),
    getOnlinePresenceStats().catch(() => ({
      window_minutes: 1,
      online_users: 0,
      online_guests: 0,
      online_total: 0,
      by_role: {},
    })),
    getTodayConversionPct(),
    getPendingActions(),
    db
      .query(
        `SELECT id, full_name, role, created_at
         FROM users
         WHERE deleted_at IS NULL
           AND (created_at AT TIME ZONE 'Asia/Baku')::date = ${today}
         ORDER BY created_at DESC
         LIMIT 8`,
      )
      .then((r) => r.rows || [])
      .catch(() => []),
  ]);

  return {
    generated_at: new Date().toISOString(),
    refresh_seconds: REFRESH_SECONDS,
    pulse: {
      new_students_today: newStudentsToday,
      new_instructors_today: newInstructorsToday,
      active_users_online: online.online_users || 0,
      mrr_azn: roundMoney(financial.mrr_azn),
      active_paid_instructors: financial.active_paid_instructors || 0,
      conversion_pct_today: conversionPct,
    },
    live_online: {
      window_minutes: online.window_minutes || 1,
      total: online.online_total || 0,
      users: online.online_users || 0,
      guests: online.online_guests || 0,
      by_role: online.by_role || {},
    },
    pending_actions: pending.items,
    pending_total: pending.pending_total,
    recent_today: recentToday.map((u) => ({
      id: u.id,
      full_name: u.full_name,
      role: u.role,
      created_at: u.created_at,
    })),
  };
}

module.exports = { getCeoDashboard, REFRESH_SECONDS };
