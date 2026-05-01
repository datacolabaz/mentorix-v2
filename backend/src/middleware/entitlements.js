const { resolveEntitlements } = require('../services/billingEntitlements');

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
    if (lim != null && used >= lim) throw httpError('STUDENT_LIMIT', 429, 'STUDENT_LIMIT');
    next();
  } catch (e) {
    next(e);
  }
}

function enforceStorageLimit(req, _res, next) {
  try {
    const e = req.entitlements;
    if (!e) return next();
    const lim = e.limits?.storage_mb;
    const used = e.usage?.storage_mb ?? 0;
    if (lim != null && used >= lim) throw httpError('STORAGE_LIMIT', 429, 'STORAGE_LIMIT');
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
    if (lim != null && used >= lim) throw httpError('SMS_LIMIT', 429, 'SMS_LIMIT');
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

