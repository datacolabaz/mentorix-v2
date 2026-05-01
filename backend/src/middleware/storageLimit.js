const fs = require('fs');
const db = require('../utils/db');
const { bytesToMbInt } = require('../services/resourceUsageService');
const { resolveEntitlements, bumpUsageCountersTx } = require('../services/billingEntitlements');

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

    // Only instructors are billed for storage in this stage.
    if (req.user.role !== 'instructor') return next();

    const ent = await resolveEntitlements(req.user.id);
    const limitMb = ent?.limits?.storage_mb; // null => unlimited
    const usedMb = Number(ent?.usage?.storage_mb || 0) || 0;
    const addMb = bytesToMbInt(req.file.size || 0);
    const addBytes = Number(req.file.size) || 0;

    if (limitMb != null && usedMb + addMb > Number(limitMb)) {
      safeUnlink(req.file.path);
      return res.status(429).json({
        success: false,
        code: 'STORAGE_LIMIT',
        message: `Storage limitiniz dolub (${usedMb}/${Number(limitMb)}MB).`,
      });
    }

    // Always track usage (even if unlimited) for analytics + future billing.
    await db.transaction(async (client) => {
      await bumpUsageCountersTx(client, req.user.id, { storage_used_mb: addMb });
      // Keep legacy bytes counter in instructor_profiles if present (best-effort)
      await client
        .query(
          `UPDATE instructor_profiles
           SET storage_used_mb = COALESCE(storage_used_mb,0) + $2,
               storage_used_bytes = COALESCE(storage_used_bytes,0) + $3,
               usage_synced_at = NOW()
           WHERE user_id = $1`,
          [req.user.id, addMb, addBytes],
        )
        .catch(() => {});
    });

    next();
  } catch (e) {
    next(e);
  }
}

module.exports = { enforceStorageLimitAfterUpload };

