const fs = require('fs');
const db = require('../utils/db');
const { bytesToMbInt } = require('../services/resourceUsageService');

function safeUnlink(absPath) {
  try {
    fs.unlinkSync(absPath);
  } catch {
    // ignore
  }
}

async function enforceStorageLimitAfterUpload(req, res, next) {
  try {
    if (!req.file || !req.user?.id) return next();

    const { rows } = await db.query(
      'SELECT storage_limit_mb, storage_used_mb FROM instructor_profiles WHERE user_id = $1',
      [req.user.id],
    );
    const p = rows[0];
    if (!p) return next();

    const limitMb = Number(p.storage_limit_mb) || 0;
    const usedMb = Number(p.storage_used_mb) || 0;
    const addMb = bytesToMbInt(req.file.size || 0);
    const addBytes = Number(req.file.size) || 0;

    // If limit is 0 or null-ish, treat as unlimited (safety default).
    if (limitMb > 0 && usedMb + addMb > limitMb) {
      safeUnlink(req.file.path);
      return res.status(429).json({
        success: false,
        code: 'STORAGE_LIMIT_EXCEEDED',
        message: `Storage limitiniz dolub (${usedMb}/${limitMb}MB). Yeni fayl yükləmək üçün admin ilə əlaqə saxlayın.`,
      });
    }

    if (limitMb > 0) {
      await db.query(
        `UPDATE instructor_profiles
         SET storage_used_mb = storage_used_mb + $2,
             storage_used_bytes = COALESCE(storage_used_bytes,0) + $3,
             usage_synced_at = NOW()
         WHERE user_id = $1`,
        [req.user.id, addMb, addBytes],
      );
    }

    next();
  } catch (e) {
    next(e);
  }
}

module.exports = { enforceStorageLimitAfterUpload };

