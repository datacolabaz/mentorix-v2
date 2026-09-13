const db = require('../utils/db');
const { getLiveRecordingStorage } = require('../services/storage/LocalDiskStorageProvider');
const { releaseRecordingQuota } = require('../services/liveRecordingQuotaService');

/**
 * Soft-delete expired recordings and remove files. Safe to re-run.
 */
async function cleanupExpiredLiveRecordings({ limit = 100 } = {}) {
  const { rows } = await db.query(
    `SELECT *
     FROM live_recordings
     WHERE deleted_at IS NULL
       AND expires_at IS NOT NULL
       AND expires_at <= NOW()
     ORDER BY expires_at ASC
     LIMIT $1`,
    [Math.min(500, Math.max(1, Number(limit) || 100))],
  );

  const storage = getLiveRecordingStorage();
  let cleaned = 0;
  for (const row of rows) {
    try {
      await releaseRecordingQuota(row);
      const key = row.storage_key || row.filename;
      if (key) await storage.delete(key);
      cleaned += 1;
    } catch (e) {
      console.error('[liveRecordingCleanup]', row.id, e.message);
    }
  }
  return { scanned: rows.length, cleaned };
}

module.exports = { cleanupExpiredLiveRecordings };
