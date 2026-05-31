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
    const limitMb = ent?.limits?.storage_mb;
    const limitBytes = ent?.limits?.storage_limit_bytes;
    const usedMb = Number(ent?.usage?.storage_mb || 0) || 0;
    const usedBytes = Number(ent?.usage?.storage_bytes ?? 0) || 0;
    const addMb = bytesToMbInt(req.file.size || 0);
    const addBytes = Number(req.file.size) || 0;

    if (
      limitBytes != null &&
      Number.isFinite(Number(limitBytes)) &&
      usedBytes + addBytes > Number(limitBytes)
    ) {
      safeUnlink(req.file.path);
      const planB = Number(ent?.limits?.storage_limit_bytes_plan);
      const extraB = Number(ent?.limits?.extra_storage_bytes || 0) || 0;
      const totalMb = Math.round(Number(limitBytes) / (1024 * 1024));
      const usedMb = Math.round(usedBytes / (1024 * 1024));
      const hint =
        extraB > 0 || (Number.isFinite(planB) && planB > 0)
          ? ` (paket + əlavə: ~${totalMb} MB, istifadə: ~${usedMb} MB)`
          : '';
      return res.status(429).json({
        success: false,
        code: 'STORAGE_LIMIT',
        message: `Yaddaş limitinə çatdınız${hint}. Tənzimləmələr → «Əlavə yaddaş al» və ya paketi yüksəldin.`,
      });
    }

    if (limitMb != null && usedMb + addMb > Number(limitMb)) {
      safeUnlink(req.file.path);
      return res.status(429).json({
        success: false,
        code: 'STORAGE_LIMIT',
        message: `Yaddaş limitiniz dolub (${usedMb}/${Number(limitMb)} MB).`,
      });
    }

    // Always track usage (even if unlimited) for analytics + future billing.
    await db.transaction(async (client) => {
      await bumpUsageCountersTx(client, req.user.id, { storage_used_mb: addMb, storage_used_bytes: addBytes });
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

