const db = require('../utils/db');
const { clientIp } = require('../utils/clientIp');

/** Autentifikasiya hadisəsini jurnala yazır; xəta giriş axınını heç vaxt dayandırmır. */
function logAuthEvent(req, { event, userId = null, googleSub = null, email = null, metadata = {} }) {
  const ip = req ? String(clientIp(req) || '').slice(0, 100) || null : null;
  const ua = req?.headers?.['user-agent'] ? String(req.headers['user-agent']).slice(0, 300) : null;
  db.query(
    `INSERT INTO auth_events (user_id, event, google_sub, email, ip, user_agent, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [userId, event, googleSub, email ? String(email).toLowerCase() : null, ip, ua, JSON.stringify(metadata || {})],
  ).catch((err) => console.error('[auth-events]', event, err.message));
}

module.exports = { logAuthEvent };
