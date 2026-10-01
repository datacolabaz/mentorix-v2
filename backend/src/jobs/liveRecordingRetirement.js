/**
 * Retired internal-video recordings: notice first, delete 30 days later — and only when explicitly enabled.
 *
 * 1. sendRecordingRetirementNotices: every teacher with stored recordings gets ONE mandatory email +
 *    in-app notice (count + delete-after date, link to the export list). Recordings are marked
 *    `retirement_notice_sent_at` only after the notification was created.
 * 2. purgeNoticedLegacyRecordings: only recordings whose notice is at least 30 days old. Destructive ONLY
 *    when LIVE_RECORDING_PURGE_ENABLED=true; otherwise (default) a dry run that logs what it would delete.
 *    The old plan-retention cleanup (jobs/liveRecordingCleanup.js) stays paused.
 */
const db = require('../utils/db');

const RETENTION_DAYS = 30;
const DAY_MS = 86400000;
const PURGE_FLAG = 'LIVE_RECORDING_PURGE_ENABLED';

function purgeEnabled(env = process.env) {
  return String(env[PURGE_FLAG] || '').trim().toLowerCase() === 'true';
}

function bakuDate(value) {
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return '';
  const [y, m, d] = new Date(t + 4 * 60 * 60 * 1000).toISOString().slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

/** ISO date after which a noticed recording may be purged (null when not noticed yet). */
function recordingDeleteAfter(noticeSentAt) {
  if (!noticeSentAt) return null;
  const t = new Date(noticeSentAt).getTime();
  return Number.isFinite(t) ? new Date(t + RETENTION_DAYS * DAY_MS).toISOString() : null;
}

function formatGb(bytes) {
  const n = Math.max(0, Number(bytes) || 0);
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(n / 1024 ** 2))} MB`;
}

async function sendRecordingRetirementNotices({ now = new Date() } = {}) {
  const { createNotificationSafe } = require('../services/notificationService');
  let rows;
  try {
    ({ rows } = await db.query(
      `SELECT lr.instructor_id, COUNT(*)::int AS count, COALESCE(SUM(lr.byte_size), 0)::bigint AS bytes
       FROM live_recordings lr
       JOIN users u ON u.id = lr.instructor_id AND u.deleted_at IS NULL
       WHERE lr.deleted_at IS NULL AND lr.retirement_notice_sent_at IS NULL
       GROUP BY lr.instructor_id`,
    ));
  } catch (e) {
    if (e?.code === '42703' || e?.code === '42P01') return { teachers: 0, notified: 0, skipped: 'migration_pending' };
    throw e;
  }
  const noticeAt = new Date(now);
  const deleteAfter = bakuDate(noticeAt.getTime() + RETENTION_DAYS * DAY_MS);
  const stats = { teachers: rows.length, notified: 0, recordings: 0 };
  for (const r of rows) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const out = await createNotificationSafe({
        recipientId: r.instructor_id,
        category: 'live_lesson',
        eventType: 'legacy_recordings_retiring',
        priority: 'HIGH',
        params: { count: String(r.count), size: formatGb(r.bytes), deleteAfter },
        meta: { href: '/instructor/live-lessons#legacy-recordings' },
        providerWorkspaceId: r.instructor_id,
        dedupeKey: `legacy_recordings_retiring:${r.instructor_id}`,
        email: true,
      });
      if (!out?.created && !out?.deduped) continue;
      // eslint-disable-next-line no-await-in-loop
      const { rowCount } = await db.query(
        `UPDATE live_recordings SET retirement_notice_sent_at = $2
         WHERE instructor_id = $1 AND deleted_at IS NULL AND retirement_notice_sent_at IS NULL`,
        [r.instructor_id, noticeAt.toISOString()],
      );
      stats.notified += 1;
      stats.recordings += rowCount || 0;
    } catch (e) {
      console.error('[recording-retirement] notice', String(r.instructor_id).slice(0, 8), e?.message || e);
    }
  }
  return stats;
}

async function purgeNoticedLegacyRecordings({ now = new Date(), limit = 100, env = process.env } = {}) {
  const cutoff = new Date(new Date(now).getTime() - RETENTION_DAYS * DAY_MS).toISOString();
  let rows;
  try {
    ({ rows } = await db.query(
      `SELECT * FROM live_recordings
       WHERE deleted_at IS NULL
         AND retirement_notice_sent_at IS NOT NULL
         AND retirement_notice_sent_at <= $1::timestamptz
       ORDER BY retirement_notice_sent_at ASC
       LIMIT $2`,
      [cutoff, Math.min(500, Math.max(1, Number(limit) || 100))],
    ));
  } catch (e) {
    if (e?.code === '42703' || e?.code === '42P01') return { dryRun: true, candidates: 0, deleted: 0, skipped: 'migration_pending' };
    throw e;
  }
  const bytes = rows.reduce((s, r) => s + (Number(r.byte_size) || 0), 0);
  if (!purgeEnabled(env)) {
    if (rows.length) {
      console.log(
        `[recording-purge] DRY RUN (${PURGE_FLAG} is not "true"): would delete ${rows.length} recording(s), ${bytes} bytes:`,
        rows.map((r) => r.id).join(','),
      );
    }
    return { dryRun: true, candidates: rows.length, bytes, deleted: 0 };
  }
  const { getLiveRecordingStorage } = require('../services/storage/LocalDiskStorageProvider');
  const { releaseRecordingQuota } = require('../services/liveRecordingQuotaService');
  const storage = getLiveRecordingStorage();
  let deleted = 0;
  for (const row of rows) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await releaseRecordingQuota(row);
      const key = row.storage_key || row.filename;
      // eslint-disable-next-line no-await-in-loop
      if (key) await storage.delete(key);
      deleted += 1;
    } catch (e) {
      console.error('[recording-purge]', row.id, e?.message || e);
    }
  }
  console.log(`[recording-purge] deleted ${deleted}/${rows.length} noticed recording(s)`);
  return { dryRun: false, candidates: rows.length, bytes, deleted };
}

module.exports = {
  RETENTION_DAYS,
  PURGE_FLAG,
  purgeEnabled,
  recordingDeleteAfter,
  sendRecordingRetirementNotices,
  purgeNoticedLegacyRecordings,
};
