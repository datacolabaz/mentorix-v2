const db = require('../utils/db');

function backoffMinutes(retryCount) {
  // 1m -> 5m -> 15m -> stop
  if (retryCount <= 0) return 1;
  if (retryCount === 1) return 5;
  return 15;
}

async function enqueueNotification({
  channel,
  event_type,
  unique_key,
  user_id = null,
  instructor_id = null,
  to_addr,
  subject = null,
  body,
  context = null,
}) {
  const uk = String(unique_key || '').trim();
  if (!uk) throw new Error('unique_key required');
  const ch = String(channel || '').trim().toLowerCase();
  if (ch !== 'sms' && ch !== 'email') throw new Error('channel must be sms|email');
  const ev = String(event_type || '').trim();
  if (!ev) throw new Error('event_type required');
  const to = String(to_addr || '').trim();
  if (!to) throw new Error('to_addr required');
  const b = String(body || '').trim();
  if (!b) throw new Error('body required');

  await db.query(
    `INSERT INTO notification_queue
       (channel, event_type, unique_key, user_id, instructor_id, to_addr, subject, body, context, status, retry_count, next_retry_at)
     VALUES
       ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'pending',0,NOW())
     ON CONFLICT (unique_key) DO NOTHING`,
    [ch, ev, uk, user_id, instructor_id, to, subject, b, context ? JSON.stringify(context) : null]
  );
}

async function fetchDue(limit = 50) {
  const lim = Math.min(200, Math.max(1, Number(limit) || 50));
  const { rows } = await db.query(
    `SELECT *
     FROM notification_queue
     WHERE status IN ('pending','retrying')
       AND next_retry_at <= NOW()
     ORDER BY next_retry_at ASC
     LIMIT $1`,
    [lim]
  );
  return rows || [];
}

async function markSent(id) {
  await db.query(
    `UPDATE notification_queue
     SET status='sent', sent_at=NOW(), updated_at=NOW()
     WHERE id=$1`,
    [id]
  );
}

async function markFailedOrRetrying(id, retryCount, errMsg) {
  const nextMins = backoffMinutes(retryCount);
  const stop = retryCount >= 3;
  await db.query(
    `UPDATE notification_queue
     SET status = $2,
         retry_count = $3,
         last_error = $4,
         next_retry_at = CASE WHEN $2='retrying' THEN NOW() + ($5 || ' minutes')::interval ELSE next_retry_at END,
         updated_at = NOW()
     WHERE id = $1`,
    [id, stop ? 'failed' : 'retrying', retryCount, String(errMsg || '').slice(0, 500), String(nextMins)]
  );
}

module.exports = {
  enqueueNotification,
  fetchDue,
  markSent,
  markFailedOrRetrying,
};

