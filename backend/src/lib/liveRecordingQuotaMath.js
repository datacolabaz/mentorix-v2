/** Pure quota math — unit-tested, no I/O. */

const HOUR_SEC = 3600;

function hoursToSeconds(hours) {
  if (hours == null) return null;
  const n = Number(hours);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * HOUR_SEC);
}

function secondsToHours(sec) {
  const n = Math.max(0, Number(sec) || 0);
  return Math.round((n / HOUR_SEC) * 100) / 100;
}

function normalizeRecordingLimits(raw = {}) {
  const hours =
    raw.recording_hours_monthly == null || raw.recording_hours_monthly === ''
      ? 0
      : Number(raw.recording_hours_monthly);
  const storageBytes =
    raw.recording_storage_bytes == null || raw.recording_storage_bytes === ''
      ? 0
      : Number(raw.recording_storage_bytes);
  const retentionDays =
    raw.recording_retention_days == null || raw.recording_retention_days === ''
      ? 0
      : Number(raw.recording_retention_days);
  const maxDurationSec =
    raw.recording_max_duration_sec == null || raw.recording_max_duration_sec === ''
      ? 0
      : Number(raw.recording_max_duration_sec);
  const quality =
    raw.recording_max_quality == null || String(raw.recording_max_quality).trim() === ''
      ? null
      : String(raw.recording_max_quality).trim();

  return {
    hours_monthly: Number.isFinite(hours) ? Math.max(0, hours) : 0,
    seconds_monthly: hoursToSeconds(Number.isFinite(hours) ? Math.max(0, hours) : 0),
    storage_bytes: Number.isFinite(storageBytes) ? Math.max(0, Math.floor(storageBytes)) : 0,
    retention_days: Number.isFinite(retentionDays) ? Math.max(0, Math.floor(retentionDays)) : 0,
    max_duration_sec: Number.isFinite(maxDurationSec)
      ? Math.max(0, Math.floor(maxDurationSec))
      : 0,
    max_quality: quality,
  };
}

/**
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
function checkRecordingUploadQuota({
  limits,
  usedSeconds,
  usedStorageBytes,
  incomingDurationSec,
  incomingByteSize,
  releasingSeconds = 0,
  releasingBytes = 0,
}) {
  const lim = normalizeRecordingLimits(limits);
  if (lim.hours_monthly <= 0 || lim.storage_bytes <= 0 || lim.max_duration_sec <= 0) {
    return {
      ok: false,
      code: 'RECORDING_NOT_INCLUDED',
      message: 'Bu paketdə dərs yazısı yoxdur. Paketi yüksəldin.',
    };
  }

  const duration = Math.max(0, Math.round(Number(incomingDurationSec) || 0));
  const bytes = Math.max(0, Math.floor(Number(incomingByteSize) || 0));
  const usedSec = Math.max(0, Math.floor(Number(usedSeconds) || 0));
  const usedBytes = Math.max(0, Math.floor(Number(usedStorageBytes) || 0));
  const releaseSec = Math.max(0, Math.floor(Number(releasingSeconds) || 0));
  const releaseBytes = Math.max(0, Math.floor(Number(releasingBytes) || 0));

  if (duration > lim.max_duration_sec) {
    return {
      ok: false,
      code: 'RECORDING_MAX_DURATION',
      message: `Yazı maksimum ${Math.floor(lim.max_duration_sec / 60)} dəqiqə ola bilər.`,
    };
  }

  const effectiveUsedSec = Math.max(0, usedSec - releaseSec);
  const effectiveUsedBytes = Math.max(0, usedBytes - releaseBytes);

  if (effectiveUsedSec + duration > lim.seconds_monthly) {
    return {
      ok: false,
      code: 'RECORDING_HOURS_EXCEEDED',
      message: 'Aylıq yazı saatı limiti dolub. Paketi yüksəldin və ya növbəti ayı gözləyin.',
    };
  }

  if (effectiveUsedBytes + bytes > lim.storage_bytes) {
    return {
      ok: false,
      code: 'RECORDING_STORAGE_EXCEEDED',
      message: 'Yazı saxlama yeri dolub. Köhnə yazıları silin və ya paketi yüksəldin.',
    };
  }

  return { ok: true };
}

function computeExpiresAt(createdAt, retentionDays) {
  const days = Math.max(0, Math.floor(Number(retentionDays) || 0));
  if (days <= 0) return null;
  const base = createdAt ? new Date(createdAt) : new Date();
  if (Number.isNaN(base.getTime())) return null;
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function usageMeter({ limits, usedSeconds, usedStorageBytes }) {
  const lim = normalizeRecordingLimits(limits);
  const usedSec = Math.max(0, Math.floor(Number(usedSeconds) || 0));
  const usedBytes = Math.max(0, Math.floor(Number(usedStorageBytes) || 0));
  const hoursUsed = secondsToHours(usedSec);
  const hoursLimit = lim.hours_monthly;
  const hoursPct =
    hoursLimit > 0 ? Math.min(100, Math.round((hoursUsed / hoursLimit) * 1000) / 10) : 100;
  const storagePct =
    lim.storage_bytes > 0
      ? Math.min(100, Math.round((usedBytes / lim.storage_bytes) * 1000) / 10)
      : 100;
  const recordingEnabled = lim.hours_monthly > 0 && lim.storage_bytes > 0 && lim.max_duration_sec > 0;
  const nearLimit = recordingEnabled && (hoursPct >= 80 || storagePct >= 80);
  const atLimit =
    !recordingEnabled ||
    (lim.seconds_monthly > 0 && usedSec >= lim.seconds_monthly) ||
    (lim.storage_bytes > 0 && usedBytes >= lim.storage_bytes);

  return {
    recording_enabled: recordingEnabled,
    hours_used: hoursUsed,
    hours_limit: hoursLimit,
    hours_remaining: Math.max(0, Math.round((hoursLimit - hoursUsed) * 100) / 100),
    hours_pct: hoursPct,
    storage_used_bytes: usedBytes,
    storage_limit_bytes: lim.storage_bytes,
    storage_remaining_bytes: Math.max(0, lim.storage_bytes - usedBytes),
    storage_pct: storagePct,
    retention_days: lim.retention_days,
    max_duration_sec: lim.max_duration_sec,
    max_quality: lim.max_quality,
    near_limit: nearLimit,
    at_limit: atLimit,
  };
}

module.exports = {
  HOUR_SEC,
  hoursToSeconds,
  secondsToHours,
  normalizeRecordingLimits,
  checkRecordingUploadQuota,
  computeExpiresAt,
  usageMeter,
};
