const db = require('../utils/db');
const { deviceTypeFromRequest } = require('../utils/deviceType');

const ALLOWED_EVENTS = new Set(['login', 'logout', 'landing_view']);

function clampDays(raw, fallback = 7) {
  const n = parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(90, Math.max(1, n));
}

async function recordAccessEvent(req, payload = {}) {
  const eventType = String(payload.event_type || '').trim().toLowerCase();
  if (!ALLOWED_EVENTS.has(eventType)) return;

  const deviceType = deviceTypeFromRequest(req, payload.device_type);
  const userId = payload.user_id || req?.user?.id || null;
  const role = payload.role != null ? String(payload.role).trim().slice(0, 32) : req?.user?.role || null;
  const path = payload.path != null ? String(payload.path).trim().slice(0, 512) : null;
  const sessionKey =
    payload.session_key != null ? String(payload.session_key).trim().slice(0, 64) : null;

  await db.query(
    `INSERT INTO access_events (event_type, user_id, role, path, device_type, session_key)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [eventType, userId, role, path, deviceType, sessionKey],
  );
}

function scheduleAccessEvent(req, payload) {
  recordAccessEvent(req, payload).catch(() => {});
}

async function getAdminTrafficStats(daysRaw) {
  const days = clampDays(daysRaw, 7);

  const { rows: todayRows } = await db.query(
    `WITH bounds AS (
       SELECT
         (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date AS day_start,
         ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date + INTERVAL '1 day') AS day_end
     ),
     ev AS (
       SELECT e.*
       FROM access_events e, bounds b
       WHERE e.created_at >= b.day_start
         AND e.created_at < b.day_end
     ),
     logins AS (
       SELECT user_id, MAX(created_at) AS last_login
       FROM ev
       WHERE event_type = 'login' AND user_id IS NOT NULL
       GROUP BY user_id
     ),
     logouts AS (
       SELECT user_id, MAX(created_at) AS last_logout
       FROM ev
       WHERE event_type = 'logout' AND user_id IS NOT NULL
       GROUP BY user_id
     )
     SELECT
       (SELECT COUNT(*)::int FROM ev WHERE event_type = 'login') AS logins_today,
       (SELECT COUNT(*)::int FROM ev WHERE event_type = 'logout') AS logouts_today,
       (SELECT COUNT(DISTINCT user_id)::int FROM ev WHERE event_type = 'login' AND user_id IS NOT NULL) AS unique_users_today,
       (SELECT COUNT(*)::int FROM ev WHERE event_type = 'landing_view') AS landing_views_today,
       (
         SELECT COUNT(*)::int
         FROM logins l
         LEFT JOIN logouts o ON o.user_id = l.user_id
         WHERE o.last_logout IS NULL OR o.last_logout < l.last_login
       ) AS still_logged_in_today,
       (
         SELECT COUNT(*)::int
         FROM access_events e, bounds b
         WHERE e.event_type = 'login'
           AND e.created_at >= NOW() - INTERVAL '60 minutes'
           AND e.user_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM access_events x
             WHERE x.user_id = e.user_id
               AND x.event_type = 'logout'
               AND x.created_at > e.created_at
               AND x.created_at >= NOW() - INTERVAL '60 minutes'
           )
       ) AS active_last_hour
     `,
  );

  const { rows: deviceRows } = await db.query(
    `SELECT device_type, COUNT(*)::int AS n
     FROM access_events
     WHERE event_type = 'login'
       AND created_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date
       AND created_at < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date + INTERVAL '1 day'
     GROUP BY device_type`,
  );

  const { rows: dailyRows } = await db.query(
    `SELECT
       (created_at AT TIME ZONE 'Asia/Baku')::date AS day,
       COUNT(*) FILTER (WHERE event_type = 'login')::int AS logins,
       COUNT(*) FILTER (WHERE event_type = 'logout')::int AS logouts,
       COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'login' AND user_id IS NOT NULL)::int AS unique_users,
       COUNT(*) FILTER (WHERE event_type = 'landing_view')::int AS landing_views,
       COUNT(*) FILTER (WHERE event_type = 'login' AND device_type = 'mobile')::int AS logins_mobile,
       COUNT(*) FILTER (WHERE event_type = 'login' AND device_type = 'desktop')::int AS logins_desktop,
       COUNT(*) FILTER (WHERE event_type = 'login' AND device_type = 'tablet')::int AS logins_tablet
     FROM access_events
     WHERE created_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date - ($1::int - 1)
     GROUP BY 1
     ORDER BY 1 DESC`,
    [days],
  );

  const devices = { mobile: 0, desktop: 0, tablet: 0, unknown: 0 };
  for (const r of deviceRows || []) {
    const k = String(r.device_type || 'unknown');
    devices[k] = Number(r.n) || 0;
  }

  const loginDeviceTotal =
    devices.mobile + devices.desktop + devices.tablet + devices.unknown;

  return {
    timezone: 'Asia/Baku',
    days,
    today: todayRows[0] || {
      logins_today: 0,
      logouts_today: 0,
      unique_users_today: 0,
      landing_views_today: 0,
      still_logged_in_today: 0,
      active_last_hour: 0,
    },
    devices_today: devices,
    device_share_today: {
      mobile_pct:
        loginDeviceTotal > 0 ? Math.round((devices.mobile / loginDeviceTotal) * 100) : null,
      desktop_pct:
        loginDeviceTotal > 0 ? Math.round((devices.desktop / loginDeviceTotal) * 100) : null,
      tablet_pct:
        loginDeviceTotal > 0 ? Math.round((devices.tablet / loginDeviceTotal) * 100) : null,
    },
    daily: (dailyRows || []).map((r) => ({
      day: r.day,
      logins: Number(r.logins) || 0,
      logouts: Number(r.logouts) || 0,
      unique_users: Number(r.unique_users) || 0,
      landing_views: Number(r.landing_views) || 0,
      logins_mobile: Number(r.logins_mobile) || 0,
      logins_desktop: Number(r.logins_desktop) || 0,
      logins_tablet: Number(r.logins_tablet) || 0,
    })),
  };
}

module.exports = {
  recordAccessEvent,
  scheduleAccessEvent,
  getAdminTrafficStats,
  ALLOWED_EVENTS,
};
