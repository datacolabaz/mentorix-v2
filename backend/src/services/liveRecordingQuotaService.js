const db = require('../utils/db');
const getCurrentPlan = require('./billingGetCurrentPlan');
const { getActivePlansMap } = require('./subscriptionPlansService');
const { PLANS, normalizePlanSlug } = require('../config/plans');
const {
  normalizeRecordingLimits,
  checkRecordingUploadQuota,
  computeExpiresAt,
  usageMeter,
  hoursToSeconds,
} = require('../lib/liveRecordingQuotaMath');

const TZ = 'Asia/Baku';

function httpError(code, status, message) {
  const err = new Error(message || code);
  err.code = code;
  err.status = status;
  err.statusCode = status;
  return err;
}

async function currentYmBaku(client = db) {
  const { rows } = await client.query(
    `SELECT to_char((CURRENT_TIMESTAMP AT TIME ZONE '${TZ}'), 'YYYY-MM') AS ym`,
  );
  return rows[0]?.ym || new Date().toISOString().slice(0, 7);
}

function fallbackRecordingLimits(slug) {
  const p = PLANS[normalizePlanSlug(slug)] || PLANS.basic;
  return {
    recording_hours_monthly: p.recording_hours_monthly ?? 0,
    recording_storage_bytes: p.recording_storage_bytes ?? 0,
    recording_retention_days: p.recording_retention_days ?? 0,
    recording_max_duration_sec: p.recording_max_duration_sec ?? 0,
    recording_max_quality: p.recording_max_quality ?? null,
  };
}

async function getInstructorRecordingLimits(instructorId, client = db) {
  const sub = await getCurrentPlan(client, instructorId);
  const slug = normalizePlanSlug(sub.plan);
  let map = {};
  try {
    map = await getActivePlansMap();
  } catch {
    map = {};
  }
  const plan = map[slug];
  const raw = plan?.recording_limits
    ? {
        recording_hours_monthly: plan.recording_limits.hours_monthly,
        recording_storage_bytes: plan.recording_limits.storage_bytes,
        recording_retention_days: plan.recording_limits.retention_days,
        recording_max_duration_sec: plan.recording_limits.max_duration_sec,
        recording_max_quality: plan.recording_limits.max_quality,
      }
    : fallbackRecordingLimits(slug);

  // Prefer DB columns when present on plan row via recording_limits or nested limits
  if (plan?.limits) {
    const L = plan.limits;
    if (L.recording_hours_monthly != null || L.recording_storage_bytes != null) {
      Object.assign(raw, {
        recording_hours_monthly: L.recording_hours_monthly ?? raw.recording_hours_monthly,
        recording_storage_bytes: L.recording_storage_bytes ?? raw.recording_storage_bytes,
        recording_retention_days: L.recording_retention_days ?? raw.recording_retention_days,
        recording_max_duration_sec: L.recording_max_duration_sec ?? raw.recording_max_duration_sec,
        recording_max_quality: L.recording_max_quality ?? raw.recording_max_quality,
      });
    }
  }

  return {
    plan: slug,
    subscription_status: sub.status,
    limits: normalizeRecordingLimits(raw),
  };
}

async function ensureRecordingUsageRow(client, instructorId, ym) {
  await client.query(
    `INSERT INTO usage_counters (user_id, students_count, storage_used_mb, storage_used_bytes, sms_used_monthly, sms_period_ym, recording_seconds_used_monthly, recording_period_ym)
     VALUES ($1, 0, 0, 0, 0, $2, 0, $2)
     ON CONFLICT (user_id) DO NOTHING`,
    [instructorId, ym],
  );

  const { rows } = await client.query(
    `SELECT recording_seconds_used_monthly, recording_period_ym
     FROM usage_counters WHERE user_id = $1 FOR UPDATE`,
    [instructorId],
  );
  let usage = rows[0] || { recording_seconds_used_monthly: 0, recording_period_ym: ym };
  if (String(usage.recording_period_ym || '') !== String(ym)) {
    const { rows: reset } = await client.query(
      `UPDATE usage_counters
       SET recording_seconds_used_monthly = 0,
           recording_period_ym = $2,
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING recording_seconds_used_monthly, recording_period_ym`,
      [instructorId, ym],
    );
    usage = reset[0] || { recording_seconds_used_monthly: 0, recording_period_ym: ym };
  }
  return usage;
}

async function getActiveStorageUsedBytes(client, instructorId) {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(byte_size), 0)::bigint AS used
     FROM live_recordings
     WHERE instructor_id = $1
       AND deleted_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [instructorId],
  );
  return Number(rows[0]?.used || 0);
}

async function getRecordingUsageSnapshot(instructorId) {
  const { plan, limits, subscription_status } = await getInstructorRecordingLimits(instructorId);
  const ym = await currentYmBaku();
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const usage = await ensureRecordingUsageRow(client, instructorId, ym);
    const storageUsed = await getActiveStorageUsedBytes(client, instructorId);
    await client.query('COMMIT');
    const meter = usageMeter({
      limits,
      usedSeconds: usage.recording_seconds_used_monthly,
      usedStorageBytes: storageUsed,
    });
    return {
      plan,
      subscription_status,
      period_ym: ym,
      ...meter,
    };
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Assert instructor may start recording (hours/storage remaining).
 */
async function assertCanStartRecording(instructorId) {
  const snap = await getRecordingUsageSnapshot(instructorId);
  if (!snap.recording_enabled) {
    throw httpError(
      'RECORDING_NOT_INCLUDED',
      403,
      'Bu paketdə dərs yazısı yoxdur. Paketi yüksəldin.',
    );
  }
  if (snap.at_limit) {
    throw httpError(
      'RECORDING_QUOTA_EXCEEDED',
      429,
      'Yazı limiti dolub. Saat və ya saxlama yerini azad edin, və ya paketi yüksəldin.',
    );
  }
  return snap;
}

/**
 * Concurrency-safe upload accounting inside a transaction.
 * Replaces prior room recording atomically (releases old quota once).
 */
async function commitRecordingWithQuota({
  roomId,
  instructorId,
  uploadedByUserId,
  filename,
  contentType,
  byteSize,
  durationSec,
  shareToken,
}) {
  const { limits } = await getInstructorRecordingLimits(instructorId);
  const ym = await currentYmBaku();
  const duration = Math.max(0, Math.round(Number(durationSec) || 0));
  const bytes = Math.max(0, Math.floor(Number(byteSize) || 0));
  const expiresAt = computeExpiresAt(new Date(), limits.retention_days);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const usage = await ensureRecordingUsageRow(client, instructorId, ym);
    const storageUsed = await getActiveStorageUsedBytes(client, instructorId);

    const { rows: existingRows } = await client.query(
      `SELECT * FROM live_recordings WHERE room_id = $1 FOR UPDATE`,
      [roomId],
    );
    const existing = existingRows[0] || null;

    let releasingSeconds = 0;
    let releasingBytes = 0;
    if (existing && !existing.deleted_at) {
      if (existing.quota_duration_accounted && String(existing.quota_period_ym) === String(ym)) {
        releasingSeconds = Math.max(0, Number(existing.duration_sec) || 0);
      }
      if (existing.quota_storage_accounted) {
        releasingBytes = Math.max(0, Number(existing.byte_size) || 0);
      }
    }

    const check = checkRecordingUploadQuota({
      limits,
      usedSeconds: usage.recording_seconds_used_monthly,
      usedStorageBytes: storageUsed,
      incomingDurationSec: duration,
      incomingByteSize: bytes,
      releasingSeconds,
      releasingBytes,
    });
    if (!check.ok) {
      throw httpError(check.code, check.code === 'RECORDING_NOT_INCLUDED' ? 403 : 429, check.message);
    }

    const deltaSec = duration - releasingSeconds;
    if (deltaSec !== 0) {
      await client.query(
        `UPDATE usage_counters
         SET recording_seconds_used_monthly = GREATEST(0, recording_seconds_used_monthly + $2),
             updated_at = NOW()
         WHERE user_id = $1`,
        [instructorId, deltaSec],
      );
    }

    const { rows } = await client.query(
      `INSERT INTO live_recordings (
         room_id, instructor_id, uploaded_by_user_id, filename, storage_key, content_type,
         byte_size, duration_sec, share_token, expires_at, deleted_at,
         quota_period_ym, quota_duration_accounted, quota_storage_accounted
       ) VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,NULL,$10,TRUE,TRUE)
       ON CONFLICT (room_id) DO UPDATE SET
         uploaded_by_user_id = EXCLUDED.uploaded_by_user_id,
         filename = EXCLUDED.filename,
         storage_key = EXCLUDED.storage_key,
         content_type = EXCLUDED.content_type,
         byte_size = EXCLUDED.byte_size,
         duration_sec = EXCLUDED.duration_sec,
         share_token = COALESCE(live_recordings.share_token, EXCLUDED.share_token),
         expires_at = EXCLUDED.expires_at,
         deleted_at = NULL,
         quota_period_ym = EXCLUDED.quota_period_ym,
         quota_duration_accounted = TRUE,
         quota_storage_accounted = TRUE,
         created_at = NOW()
       RETURNING *`,
      [
        roomId,
        instructorId,
        uploadedByUserId || null,
        filename,
        contentType || 'video/webm',
        bytes,
        duration || null,
        shareToken,
        expiresAt,
        ym,
      ],
    );

    await client.query('COMMIT');
    return { recording: rows[0], replaced: existing };
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Soft-delete + release quota once (idempotent).
 */
async function releaseRecordingQuota(recording, { hardDeleteFile = true } = {}) {
  if (!recording?.id) return null;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM live_recordings WHERE id = $1 FOR UPDATE`,
      [recording.id],
    );
    const row = rows[0];
    if (!row || row.deleted_at) {
      await client.query('COMMIT');
      return row;
    }

    const ym = await currentYmBaku(client);
    if (row.quota_duration_accounted && String(row.quota_period_ym) === String(ym)) {
      const sec = Math.max(0, Number(row.duration_sec) || 0);
      if (sec > 0) {
        await client.query(
          `UPDATE usage_counters
           SET recording_seconds_used_monthly = GREATEST(0, recording_seconds_used_monthly - $2),
               updated_at = NOW()
           WHERE user_id = $1`,
          [row.instructor_id, sec],
        );
      }
    }

    const { rows: updated } = await client.query(
      `UPDATE live_recordings
       SET deleted_at = NOW(),
           quota_duration_accounted = FALSE,
           quota_storage_accounted = FALSE
       WHERE id = $1
       RETURNING *`,
      [row.id],
    );
    await client.query('COMMIT');
    return updated[0];
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  getInstructorRecordingLimits,
  getRecordingUsageSnapshot,
  assertCanStartRecording,
  commitRecordingWithQuota,
  releaseRecordingQuota,
  currentYmBaku,
  hoursToSeconds,
};
