const db = require('../utils/db');

const DEFAULT_LIMIT_PER_HOUR = 20;
const WINDOW_INTERVAL = '1 hour';

function getGenerationRateLimitPerHour() {
  const parsed = Number.parseInt(process.env.GENERATION_RATE_LIMIT_PER_HOUR, 10);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return DEFAULT_LIMIT_PER_HOUR;
}

/**
 * Sliding-window count: generation_requests rows for teacher in the last hour.
 * Persists across process restarts (PostgreSQL).
 */
async function countTeacherGenerationsLastHour(teacherId, client = db) {
  if (!teacherId) return 0;
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS cnt
     FROM generation_requests
     WHERE teacher_id = $1::uuid
       AND created_at > NOW() - INTERVAL '${WINDOW_INTERVAL}'`,
    [teacherId],
  );
  return Number(rows[0]?.cnt) || 0;
}

module.exports = {
  DEFAULT_LIMIT_PER_HOUR,
  WINDOW_INTERVAL,
  getGenerationRateLimitPerHour,
  countTeacherGenerationsLastHour,
};
