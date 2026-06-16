const db = require('../utils/db');

/** Same window as access_events online stats and product spec. */
const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const TOUCH_THROTTLE_SECONDS = 60;

function isUserOnline(lastActivityAt, nowMs = Date.now()) {
  if (!lastActivityAt) return false;
  const ts = lastActivityAt instanceof Date ? lastActivityAt.getTime() : new Date(lastActivityAt).getTime();
  if (!Number.isFinite(ts)) return false;
  return nowMs - ts <= ONLINE_WINDOW_MS;
}

function presenceFromLastActivity(lastActivityAt, nowMs = Date.now()) {
  const iso =
    lastActivityAt && Number.isFinite(new Date(lastActivityAt).getTime())
      ? new Date(lastActivityAt).toISOString()
      : null;
  return {
    last_activity_at: iso,
    is_online: isUserOnline(lastActivityAt, nowMs),
  };
}

function withPresence(row, field = 'last_activity_at') {
  if (!row || typeof row !== 'object') return row;
  const lastActivityAt = row[field];
  const { [field]: _drop, ...rest } = row;
  return { ...rest, ...presenceFromLastActivity(lastActivityAt) };
}

function mapRowsWithPresence(rows, field = 'last_activity_at') {
  const nowMs = Date.now();
  return (rows || []).map((row) => {
    const lastActivityAt = row?.[field];
    const { [field]: _drop, ...rest } = row || {};
    return { ...rest, ...presenceFromLastActivity(lastActivityAt, nowMs) };
  });
}

/** Throttled write — at most once per minute per user. */
async function touchUserActivity(userId) {
  const id = userId == null ? '' : String(userId).trim();
  if (!id) return;
  try {
    await db.query(
      `UPDATE users
       SET last_activity_at = NOW()
       WHERE id = $1::uuid
         AND deleted_at IS NULL
         AND (
           last_activity_at IS NULL
           OR last_activity_at < NOW() - ($2::text || ' seconds')::interval
         )`,
      [id, String(TOUCH_THROTTLE_SECONDS)],
    );
  } catch (err) {
    if (err?.code === '42703') return;
    throw err;
  }
}

module.exports = {
  ONLINE_WINDOW_MS,
  ONLINE_WINDOW_MINUTES: ONLINE_WINDOW_MS / 60000,
  isUserOnline,
  presenceFromLastActivity,
  withPresence,
  mapRowsWithPresence,
  touchUserActivity,
};
