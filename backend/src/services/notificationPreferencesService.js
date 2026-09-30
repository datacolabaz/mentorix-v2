const db = require('../utils/db');
const policy = require('../config/notificationPolicy');

async function isPartnerUser(userId) {
  try {
    const { rows } = await db.query(`SELECT 1 FROM partners WHERE user_id = $1 LIMIT 1`, [userId]);
    return Boolean(rows[0]);
  } catch (err) {
    if (err && err.code === '42P01') return false;
    throw err;
  }
}

async function loadCategoryOverrides(userId) {
  try {
    const { rows } = await db.query(
      `SELECT category, event_type, channel, enabled, frequency
       FROM notification_preferences
       WHERE user_id = $1 AND event_type IS NULL`,
      [userId],
    );
    return rows || [];
  } catch (err) {
    if (err && err.code === '42P01') return [];
    throw err;
  }
}

async function getPreferences(user) {
  const [isPartner, prefs] = await Promise.all([isPartnerUser(user.id), loadCategoryOverrides(user.id)]);
  return {
    categories: policy.buildPreferenceMatrix({ role: user.role, isPartner, prefs }),
    frequencies: [...policy.FREQUENCIES],
    channels: [...policy.CHANNELS],
  };
}

async function savePreferences(user, items) {
  const isPartner = await isPartnerUser(user.id);
  const v = policy.validatePreferenceUpdate({ role: user.role, isPartner, items });
  if (!v.ok) {
    const err = new Error(v.message);
    err.statusCode = 400;
    err.code = v.code;
    throw err;
  }
  if (v.rows.length) {
    await db.transaction(async (client) => {
      for (const r of v.rows) {
        await client.query(
          `INSERT INTO notification_preferences (user_id, category, event_type, channel, enabled, frequency)
           VALUES ($1, $2, NULL, $3, $4, $5)
           ON CONFLICT (user_id, category, (COALESCE(event_type, '')), channel)
           DO UPDATE SET enabled = EXCLUDED.enabled, frequency = EXCLUDED.frequency, updated_at = NOW()`,
          [user.id, r.category, r.channel, r.enabled, r.frequency],
        );
      }
    });
  }
  return getPreferences(user);
}

module.exports = { getPreferences, savePreferences, isPartnerUser };
