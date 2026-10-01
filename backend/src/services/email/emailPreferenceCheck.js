/**
 * Preference check for direct (non-notificationService) per-user emails such as
 * "new assignment" or "live lesson started". Same policy as notificationService: if the
 * user turned the category's email off (or chose a daily/weekly summary), the immediate email
 * is not sent. Role defaults keep these emails on, so behaviour only changes for users who
 * explicitly opted out. Fails open on DB errors (keeps today's behaviour).
 */
const db = require('../../utils/db');
const policy = require('../../config/notificationPolicy');

async function loadUserAndPrefs(q, userId, category) {
  const { rows: users } = await q.query(
    `SELECT id, role, locale, is_active, deleted_at FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  const user = users[0] || null;
  if (!user) return { user: null, prefs: [] };
  try {
    const { rows } = await q.query(
      `SELECT category, event_type, channel, enabled, frequency
       FROM notification_preferences
       WHERE user_id = $1 AND category = $2 AND channel = 'email'`,
      [userId, category],
    );
    return { user, prefs: rows || [] };
  } catch (err) {
    if (err && err.code === '42P01') return { user, prefs: [] };
    throw err;
  }
}

/**
 * @returns {Promise<{ allowed: boolean, reason: string, locale: string|null }>}
 */
async function checkEmailPreference({ userId, category, eventType }, opts = {}) {
  const q = opts.client || db;
  try {
    const { user, prefs } = await loadUserAndPrefs(q, userId, category);
    if (!user) return { allowed: true, reason: 'unknown_user', locale: null };
    if (user.is_active === false || user.deleted_at) return { allowed: false, reason: 'inactive', locale: user.locale };
    const d = policy.resolveDelivery({ role: user.role, category, eventType, prefs, wantsEmail: true });
    if (!d.email.eligible) return { allowed: false, reason: d.email.reason, locale: user.locale };
    if (d.email.frequency !== 'immediate') return { allowed: false, reason: 'digest', locale: user.locale };
    return { allowed: true, reason: d.email.reason, locale: user.locale };
  } catch (err) {
    console.error('[email-preference] check failed', err?.code || '', err?.message || err);
    return { allowed: true, reason: 'check_failed', locale: null };
  }
}

module.exports = { checkEmailPreference };
