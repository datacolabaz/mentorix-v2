/**
 * Admin hesabına yanlış şifrə ilə giriş cəhdləri: hər cəhd auth_events-ə `login_failed`
 * (metadata.stage = 'admin_password') yazılır; eyni admin hesabına son WINDOW_MINUTES dəqiqədə
 * THRESHOLD və ya çox cəhd olarsa bütün aktiv adminlərə CRITICAL security bildirişi gedir.
 * 15 dəqiqəlik pəncərə başına bir bildiriş (dedupe `admin_login_failures:{userId}:{bucket}`).
 * Giriş cavabını gözlətmir; IP/parol bildirişə yazılmır, email maskalanır.
 */
const db = require('../utils/db');
const { clientIp } = require('../utils/clientIp');
const { maskEmail } = require('./email/emailTransport');

const THRESHOLD = 5;
const WINDOW_MINUTES = 15;
const STAGE = 'admin_password';

async function recordAndMaybeAlert({ userId, email, ip, userAgent, now = new Date() }) {
  await db.query(
    `INSERT INTO auth_events (user_id, event, email, ip, user_agent, metadata)
     VALUES ($1, 'login_failed', $2, $3, $4, $5::jsonb)`,
    [userId, email ? String(email).toLowerCase() : null, ip, userAgent, JSON.stringify({ stage: STAGE })],
  );
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM auth_events
     WHERE user_id = $1 AND event = 'login_failed'
       AND metadata->>'stage' = $2
       AND created_at > NOW() - make_interval(mins => $3)`,
    [userId, STAGE, WINDOW_MINUTES],
  );
  const count = Number(rows[0]?.n || 0);
  if (count < THRESHOLD) return { count, alerted: false };
  const bucket = Math.floor(now.getTime() / (WINDOW_MINUTES * 60 * 1000));
  const { notifyAdmins } = require('./notificationService');
  const out = await notifyAdmins({
    category: 'security',
    eventType: 'admin_login_failures',
    priority: 'CRITICAL',
    params: { account: maskEmail(email) || 'admin', count, minutes: WINDOW_MINUTES },
    meta: { target_user_id: userId, count, window_minutes: WINDOW_MINUTES },
    dedupeKey: `admin_login_failures:${userId}:${bucket}`,
    email: true,
  });
  return { count, alerted: true, ...out };
}

/** authController-dən: yalnız mövcud admin hesabı və yanlış şifrə üçün. Heç vaxt atmır. */
function recordAdminPasswordFailure(req, user) {
  if (!user || String(user.role || '').toLowerCase() !== 'admin' || !user.id) return;
  const ip = req ? String(clientIp(req) || '').slice(0, 100) || null : null;
  const userAgent = req?.headers?.['user-agent'] ? String(req.headers['user-agent']).slice(0, 300) : null;
  const { deferNotification } = require('./notificationService');
  deferNotification('admin_login_failures', () =>
    recordAndMaybeAlert({ userId: user.id, email: user.email, ip, userAgent }),
  );
}

module.exports = { recordAdminPasswordFailure, recordAndMaybeAlert, THRESHOLD, WINDOW_MINUTES };
