const db = require('../utils/db');
const { resolveEntitlements } = require('./billingEntitlements');

/**
 * instructor_profiles SMS limiti — login PIN və digər SMS endpoint-ləri üçün vahid yoxlama.
 * @param {string|null|undefined} instructorId
 * @param {{ requireProfile?: boolean }} opts
 * @returns {Promise<{ ok: true, remaining?: number } | { ok: false, statusCode: number, body: object }>}
 */
async function checkSmsQuota(instructorId, opts = {}) {
  const requireProfile = opts.requireProfile === true;
  if (!instructorId) return { ok: true };

  try {
    const ent = await resolveEntitlements(instructorId);
    const lim = ent?.limits?.sms_monthly;
    const used = Number(ent?.usage?.sms_monthly || 0) || 0;
    if (lim != null && used >= Number(lim)) {
      return {
        ok: false,
        statusCode: 429,
        body: { success: false, message: `SMS limiti dolub (${used}/${Number(lim)}).`, code: 'SMS_LIMIT' },
      };
    }
    return { ok: true, remaining: lim == null ? undefined : Math.max(0, Number(lim) - used) };
  } catch (e) {
    if (requireProfile) {
      return {
        ok: false,
        statusCode: e.statusCode || e.status || 404,
        body: { success: false, message: e.message || 'Müəllim profili tapılmadı', code: e.code },
      };
    }
    return { ok: true };
  }
}

module.exports = { checkSmsQuota };
