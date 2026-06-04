const db = require('../utils/db');
const { labelForSource } = require('../utils/referrerSource');

const VISIT_EVENTS = ['page_view', 'landing_view'];
const FUNNEL_STEPS = [
  { key: 'landing_view', label: 'Landing səhifəsi' },
  { key: 'pricing_view', label: 'Qiymət / Demo' },
  { key: 'register_click', label: 'Qeydiyyat klik' },
  { key: 'signup_complete', label: 'Hesab yaradıldı' },
];

function normalizePeriod(raw) {
  const p = String(raw || '30d').trim().toLowerCase();
  if (p === '7d' || p === '7') return '7d';
  if (p === 'all' || p === 'lifetime') return 'all';
  return '30d';
}

function periodIntervalSql(period) {
  if (period === 'all') return null;
  if (period === '7d') return "INTERVAL '6 days'";
  return "INTERVAL '29 days'";
}

function periodWhere(period, alias = 'e') {
  const col = `${alias}.created_at`;
  if (period === 'all') return 'TRUE';
  return `${col} >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date - ${periodIntervalSql(period)}`;
}

function userPeriodWhere(period) {
  if (period === 'all') return 'TRUE';
  return `u.created_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date - ${periodIntervalSql(period)}`;
}

function monthStartSql() {
  return `date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')`;
}

function pct(part, total) {
  const t = Number(total) || 0;
  if (t <= 0) return null;
  return Math.round((Number(part) / t) * 1000) / 10;
}

function withShares(rows, valueKey = 'count') {
  const total = rows.reduce((s, r) => s + (Number(r[valueKey]) || 0), 0);
  return rows.map((r) => ({
    ...r,
    pct: pct(r[valueKey], total),
  }));
}

/**
 * Konversiya = dövr ərzində qeydiyyat / unikal ziyarətçi.
 * İzləmə natamamdırsa (qeydiyyat > unikal ziyarətçi) faiz göstərilmir.
 */
function computeConversionMetrics(registrations, uniqueVisitors) {
  const regs = Math.max(0, Number(registrations) || 0);
  const uv = Math.max(0, Number(uniqueVisitors) || 0);

  if (regs > 0 && uv < regs) {
    return {
      conversion_pct: null,
      conversion_display: 'insufficient_data',
      conversion_warning: true,
      conversion_message:
        'Ziyarətçi izləməsi bu dövrü tam əhatə etmir (analitika yeni aktiv ola bilər). Konversiya hesablanmır.',
    };
  }

  if (uv <= 0) {
    return {
      conversion_pct: regs > 0 ? null : 0,
      conversion_display: regs > 0 ? 'insufficient_data' : 'zero',
      conversion_warning: regs > 0,
      conversion_message:
        regs > 0
          ? 'Bu dövrdə ziyarətçi qeydi yoxdur — konversiya hesablanmır.'
          : null,
    };
  }

  if (regs <= 0) {
    return {
      conversion_pct: 0,
      conversion_display: 'zero',
      conversion_warning: false,
      conversion_message: null,
    };
  }

  const rawPct = (regs / uv) * 100;
  const capped = Math.min(100, Math.round(rawPct * 10) / 10);

  return {
    conversion_pct: capped,
    conversion_display: 'percent',
    conversion_warning: rawPct > 100,
    conversion_message:
      rawPct > 100
        ? 'Hesablanmış dəyər 100% ilə məhdudlaşdırılıb (ziyarətçi sayı natamam ola bilər).'
        : null,
  };
}

async function getAdminAnalyticsDashboard(periodRaw) {
  const period = normalizePeriod(periodRaw);
  const periodFilter = periodWhere(period);
  const visitTypes = VISIT_EVENTS.map((t) => `'${t}'`).join(', ');

  const [
    overviewRes,
    sourcesRes,
    pagesRes,
    devicesRes,
    funnelRes,
    recentRes,
    monthlyRes,
    trendRes,
  ] = await Promise.all([
    db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM access_events e WHERE ${periodFilter}
            AND e.event_type IN (${visitTypes})) AS total_visitors,
         (SELECT COUNT(DISTINCT COALESCE(e.session_key, e.id::text))::int FROM access_events e
            WHERE ${periodFilter} AND e.event_type IN (${visitTypes})) AS unique_visitors,
         (SELECT COUNT(*)::int FROM users u WHERE u.deleted_at IS NULL AND ${userPeriodWhere(period)}) AS registrations_in_period`,
    ),
    db.query(
      `SELECT COALESCE(NULLIF(TRIM(referrer_source), ''), 'direct') AS source,
              COUNT(DISTINCT COALESCE(session_key, id::text))::int AS count
       FROM access_events e
       WHERE ${periodFilter}
         AND e.event_type IN (${visitTypes}, 'signup_complete')
       GROUP BY 1
       ORDER BY count DESC`,
    ),
    db.query(
      `SELECT COALESCE(NULLIF(TRIM(path), ''), '/') AS path,
              COUNT(*)::int AS views
       FROM access_events e
       WHERE ${periodFilter}
         AND e.event_type IN (${visitTypes})
         AND e.path IS NOT NULL
       GROUP BY 1
       ORDER BY views DESC
       LIMIT 12`,
    ),
    db.query(
      `SELECT COALESCE(NULLIF(TRIM(device_type), ''), 'unknown') AS device_type,
              COUNT(*)::int AS count
       FROM access_events e
       WHERE ${periodFilter}
         AND e.event_type IN (${visitTypes}, 'login', 'signup_complete')
       GROUP BY 1
       ORDER BY count DESC`,
    ),
    db.query(
      `SELECT e.event_type AS step,
              COUNT(DISTINCT COALESCE(e.session_key, e.id::text))::int AS count
       FROM access_events e
       WHERE ${periodFilter}
         AND e.event_type = ANY($1::text[])
       GROUP BY e.event_type`,
      [FUNNEL_STEPS.map((s) => s.key)],
    ),
    db.query(
      `SELECT u.id, u.full_name, u.role, u.created_at,
              COALESCE(
                (SELECT ae.referrer_source FROM access_events ae
                 WHERE ae.user_id = u.id AND ae.event_type = 'signup_complete'
                 ORDER BY ae.created_at ASC LIMIT 1),
                (SELECT ae.referrer_source FROM access_events ae
                 WHERE ae.user_id = u.id
                 ORDER BY ae.created_at ASC LIMIT 1),
                'direct'
              ) AS source
       FROM users u
       WHERE u.deleted_at IS NULL AND ${userPeriodWhere(period)}
       ORDER BY u.created_at DESC
       LIMIT 12`,
    ),
    db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL
            AND created_at >= ${monthStartSql()}) AS registrations,
         (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL AND role = 'instructor'
            AND created_at >= ${monthStartSql()}) AS instructors,
         (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL AND role = 'student'
            AND created_at >= ${monthStartSql()}) AS students,
         (SELECT COUNT(*)::int FROM exams WHERE COALESCE(is_deleted, FALSE) = FALSE
            AND created_at >= ${monthStartSql()}) AS exams,
         (SELECT COUNT(*)::int FROM assignments WHERE created_at >= ${monthStartSql()}) AS assignments,
         (SELECT COUNT(*)::int FROM sms_logs
            WHERE created_at >= ${monthStartSql()}
              AND LOWER(TRIM(COALESCE(status, ''))) IN ('sent', 'delivered')) AS sms_sent,
         (
           SELECT COALESCE(SUM(amount), 0)::numeric FROM payments
           WHERE status = 'completed' AND deleted_at IS NULL
             AND COALESCE(paid_at, created_at) >= ${monthStartSql()}
         ) +
         (
           SELECT COALESCE(SUM(amount_cents), 0)::numeric / 100.0 FROM billing_payments
           WHERE LOWER(TRIM(status)) = 'paid' AND paid_at >= ${monthStartSql()}
         ) AS revenue_azn`,
    ),
    db.query(
      `SELECT (e.created_at AT TIME ZONE 'Asia/Baku')::date AS day,
              COUNT(*) FILTER (WHERE e.event_type IN (${visitTypes}))::int AS visitors,
              COUNT(*) FILTER (WHERE e.event_type = 'signup_complete')::int AS registrations
       FROM access_events e
       WHERE ${periodFilter}
       GROUP BY 1
       ORDER BY 1 ASC`,
    ),
  ]);

  const ov = overviewRes.rows[0] || {};
  const registrations = Number(ov.registrations_in_period) || 0;
  const uniqueVisitors = Number(ov.unique_visitors) || 0;
  const totalVisitors = Number(ov.total_visitors) || 0;
  const conversion = computeConversionMetrics(registrations, uniqueVisitors);

  const funnelMap = Object.fromEntries(
    (funnelRes.rows || []).map((r) => [r.step, Number(r.count) || 0]),
  );
  const funnelTop = funnelMap.landing_view || funnelMap.page_view || uniqueVisitors || 1;

  const traffic_sources = withShares(
    (sourcesRes.rows || []).map((r) => ({
      source: r.source,
      label: labelForSource(r.source),
      count: Number(r.count) || 0,
    })),
  );

  const devices = withShares(
    (devicesRes.rows || []).map((r) => ({
      device_type: r.device_type,
      count: Number(r.count) || 0,
    })),
  );

  const m = monthlyRes.rows[0] || {};

  return {
    period,
    timezone: 'Asia/Baku',
    overview: {
      total_visitors: totalVisitors,
      unique_visitors: uniqueVisitors,
      registrations,
      registrations_exceed_visitors: registrations > uniqueVisitors && registrations > 0,
      ...conversion,
    },
    traffic_sources,
    top_pages: (pagesRes.rows || []).map((r) => ({
      path: r.path,
      views: Number(r.views) || 0,
    })),
    devices,
    funnel: FUNNEL_STEPS.map((s, i) => {
      const count = funnelMap[s.key] || 0;
      const prev = i > 0 ? funnelMap[FUNNEL_STEPS[i - 1].key] || 0 : funnelTop;
      return {
        step: s.key,
        label: s.label,
        count,
        pct_of_top: pct(count, funnelTop),
        drop_from_prev_pct: i > 0 && prev > 0 ? pct(prev - count, prev) : null,
      };
    }),
    recent_registrations: (recentRes.rows || []).map((r) => ({
      id: r.id,
      full_name: r.full_name,
      role: r.role,
      created_at: r.created_at,
      source: r.source,
      source_label: labelForSource(r.source),
    })),
    monthly: {
      registrations: Number(m.registrations) || 0,
      instructors: Number(m.instructors) || 0,
      students: Number(m.students) || 0,
      exams: Number(m.exams) || 0,
      assignments: Number(m.assignments) || 0,
      sms_sent: Number(m.sms_sent) || 0,
      revenue_azn: Math.round((Number(m.revenue_azn) || 0) * 100) / 100,
    },
    trend_daily: (trendRes.rows || []).map((r) => ({
      day: r.day,
      visitors: Number(r.visitors) || 0,
      registrations: Number(r.registrations) || 0,
    })),
  };
}

module.exports = { getAdminAnalyticsDashboard, normalizePeriod };
