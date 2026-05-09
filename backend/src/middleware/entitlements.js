const db = require('../utils/db');
const { resolveEntitlements, logBillingEvent } = require('../services/billingEntitlements');

function httpError(code, status = 403, message = code) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  err.statusCode = status;
  return err;
}

async function attachEntitlements(req, _res, next) {
  try {
    if (!req.user?.id) throw httpError('UNAUTHORIZED', 401, 'UNAUTHORIZED');
    // Only instructors are gated by pricing in this stage.
    if (req.user.role !== 'instructor') return next();
    req.entitlements = await resolveEntitlements(req.user.id);
    next();
  } catch (e) {
    next(e);
  }
}

function enforceStudentsLimit(req, _res, next) {
  try {
    const e = req.entitlements;
    if (!e) return next();
    const lim = e.limits?.students;
    const used = e.usage?.students ?? 0;
    if (lim != null && used >= lim) {
      void logBillingEvent(db, { user_id: req.user?.id || null, event: 'limit_reached_students', context: { used, limit: lim } });
      throw httpError(
        'STUDENT_LIMIT',
        429,
        'Tələbə limitinə çatdınız — davam etmək üçün daha geniş paket seçin.',
      );
    }
    next();
  } catch (e) {
    next(e);
  }
}

function enforceStorageLimit(req, _res, next) {
  try {
    const e = req.entitlements;
    if (!e) return next();
    const limMb = e.limits?.storage_mb;
    const limBytes = e.limits?.storage_limit_bytes;
    const usedMb = e.usage?.storage_mb ?? 0;
    const usedBytes = e.usage?.storage_bytes ?? 0;
    if (
      limBytes != null &&
      Number.isFinite(Number(limBytes)) &&
      Number(usedBytes) >= Number(limBytes)
    ) {
      void logBillingEvent(db, {
        user_id: req.user?.id || null,
        event: 'limit_reached_storage',
        context: { used_bytes: usedBytes, limit_bytes: limBytes },
      });
      throw httpError(
        'STORAGE_LIMIT',
        429,
        'Yaddaş limitinə çatdınız — davam etmək üçün daha geniş paket seçin.',
      );
    }
    if (limMb != null && usedMb >= limMb) {
      void logBillingEvent(db, { user_id: req.user?.id || null, event: 'limit_reached_storage', context: { used: usedMb, limit: limMb } });
      throw httpError(
        'STORAGE_LIMIT',
        429,
        'Yaddaş limitinə çatdınız — davam etmək üçün daha geniş paket seçin.',
      );
    }
    next();
  } catch (e) {
    next(e);
  }
}

function enforceSmsLimit(req, _res, next) {
  try {
    const e = req.entitlements;
    if (!e) return next();
    const lim = e.limits?.sms_monthly;
    const used = e.usage?.sms_monthly ?? 0;
    if (lim != null && used >= lim) {
      void logBillingEvent(db, { user_id: req.user?.id || null, event: 'limit_reached_sms', context: { used, limit: lim } });
      throw httpError(
        'SMS_LIMIT',
        429,
        'SMS limitinə çatdınız — davam etmək üçün daha geniş paket seçin.',
      );
    }
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = {
  attachEntitlements,
  enforceStudentsLimit,
  enforceStorageLimit,
  enforceSmsLimit,
};

