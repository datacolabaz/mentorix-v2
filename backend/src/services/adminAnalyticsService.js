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

function periodDaysBack(period) {
  if (period === '7d') return 6;
  if (period === '30d') return 29;
  return null;
}

function periodIntervalSql(period) {
  const daysBack = periodDaysBack(period);
  if (daysBack == null) return null;
  return `INTERVAL '${daysBack} days'`;
}

/** Baku gün təqvimi üzrə müqayisə — server timezone-dan asılı olmur. */
function periodWhere(period, alias = 'e') {
  if (period === 'all') return 'TRUE';
  return `(${alias}.created_at AT TIME ZONE 'Asia/Baku')::date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date - ${periodIntervalSql(period)}`;
}

function userPeriodWhere(period) {
  if (period === 'all') return 'TRUE';
  return `(u.created_at AT TIME ZONE 'Asia/Baku')::date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date - ${periodIntervalSql(period)}`;
}

function ymdFromDateValue(v) {
  if (v == null) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baku' }).format(v);
  }
  const s = String(v);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function addDaysYmd(ymd, delta) {
  const [y, mo, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d + delta, 12));
  return dt.toISOString().slice(0, 10);
}

function fillTrendDaily(rows, period, todayYmd) {
  const map = new Map();
  for (const r of rows || []) {
    const key = ymdFromDateValue(r.day);
    if (!key) continue;
    map.set(key, {
      visitors: Number(r.visitors) || 0,
      registrations: Number(r.registrations) || 0,
    });
  }

  let dayKeys;
  if (period === 'all') {
    if (!map.size) return [];
    const sorted = [...map.keys()].sort();
    dayKeys = [];
    let cur = sorted[0];
    while (cur <= todayYmd) {
      dayKeys.push(cur);
      cur = addDaysYmd(cur, 1);
      if (dayKeys.length > 400) break;
    }
  } else {
    const count = period === '7d' ? 7 : 30;
    dayKeys = [];
    for (let i = count - 1; i >= 0; i -= 1) {
      dayKeys.push(addDaysYmd(todayYmd, -i));
    }
  }

  return dayKeys.map((day) => {
    const hit = map.get(day);
    return {
      day,
      visitors: hit?.visitors || 0,
      registrations: hit?.registrations || 0,
    };
  });
}

function computePeriodBounds(period, todayYmd, trackingSinceYmd) {
  if (!todayYmd) return { period_start: null, period_end: null };
  if (period === 'all') {
    return {
      period_start: trackingSinceYmd || todayYmd,
      period_end: todayYmd,
    };
  }
  const daysBack = periodDaysBack(period);
  return {
    period_start: addDaysYmd(todayYmd, -daysBack),
    period_end: todayYmd,
  };
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
         (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date AS today_baku,
         (SELECT MIN((created_at AT TIME ZONE 'Asia/Baku')::date) FROM access_events) AS tracking_since,
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
  const todayYmd = ymdFromDateValue(ov.today_baku);
  const trackingSinceYmd = ymdFromDateValue(ov.tracking_since);
  const { period_start, period_end } = computePeriodBounds(period, todayYmd, trackingSinceYmd);
  const registrations = Number(ov.re