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
      const { notifyInstructorLimitBlocked } = require('../services/instructorStudentService');
      void notifyInstructorLimitBlocked(req.user.id, lim);
      throw httpError(
        'STUDENT_LIMIT',
        429,
        `Tələbə limitiniz (${used}/${lim}) dolub! Yeni tələbələrin linklərinizə daxil ola bilməsi üçün paketinizi PRO və ya daha yüksək paketə keçirin.`,
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

function enforceExamsLimit(req, _res, next) {
  try {
    if (!req.user?.id || req.user.role === 'admin') return next();
    if (req.user.role !== 'instructor') return next();

    const e = req.entitlements;
    if (!e) return next();
    const lim = e.limits?.exams_monthly;
    const used = e.usage?.exams_monthly ?? 0;
    if (lim != null && used >= lim) {
      void logBillingEvent(db, {
        user_id: req.user?.id || null,
        event: 'limit_reached_exams',
        context: { used, limit: lim },
      });
      throw httpError(
        'EXAM_LIMIT',
        429,
        'Aylıq imtahan limitinizə çatdınız. Zəhmət olmasa paketinizi yeniləyin.',
      );
    }
    next();
  } catch (e) {
    next(e);
  }
}

function enforceHomeworksLimit(req, _res, next) {
  try {
    if (!req.user?.id || req.user.role === 'admin') return next();
    if (req.user.role !== 'instructor') return next();

    const e = req.entitlements;
    if (!e) return next();
    const lim = e.limits?.homeworks_monthly;
    const used = e.usage?.homeworks_monthly ?? 0;
    if (lim != null && used >= lim) {
      void logBillingEvent(db, {
        user_id: req.user?.id || null,
        event: 'limit_reached_homeworks',
        context: { used, limit: lim },
      });
      throw httpError(
        'HOMEWORK_LIMIT',
        429,
        'Aylıq tapşırıq limitinizə çatdınız. Zəhmət olmasa paketinizi yeniləyin.',
      );
    }
    next();
  } catch (e) {
    next(e);
  }
}

/** SADƏ sınaq bitib və ya abunəlik aktiv deyilsə — yaratma/redaktə əməliyyatlarını blokla. */
async function enforceActiveSubscription(req, res, next) {
  try {
    if (!req.user?.id || req.user.role === 'admin') return next();
    if (req.user.role !== 'instructor') return next();

    const e = req.entitlements || (await resolveEntitlements(req.user.id));
    req.entitlements = e;

    if (e.should_block) {
      void logBillingEvent(db, {
        user_id: req.user.id,
        event: 'subscription_blocked_action',
        context: { status: e.status, plan: e.plan },
      });
      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_INACTIVE',
        message:
          e.messages?.banner ||
          '14 günlük SADƏ sınaq müddəti bitib. Davam etmək üçün PRO və ya daha yüksək paket seçin.',
        status: e.status,
      });
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
  enforceExamsLimit,
  enforceHomeworksLimit,
  enforceActiveSubscription,
};

