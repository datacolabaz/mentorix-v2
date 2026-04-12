const db = require('../utils/db');

/**
 * instructor_profiles SMS limiti — login PIN və digər SMS endpoint-ləri üçün vahid yoxlama.
 * @param {string|null|undefined} instructorId
 * @param {{ requireProfile?: boolean }} opts
 * @returns {Promise<{ ok: true, remaining?: number } | { ok: false, statusCode: number, body: object }>}
 */
async function checkSmsQuota(instructorId, opts = {}) {
  const requireProfile = opts.requireProfile === true;
  if (!instructorId) return { ok: true };

  const { rows } = await db.query(
    'SELECT sms_limit, sms_used FROM instructor_profiles WHERE user_id = $1',
    [instructorId],
  );

  if (!rows[0]) {
    if (requireProfile) {
      return {
        ok: false,
        statusCode: 404,
        body: { success: false, message: 'Müəllim profili tapılmadı' },
      };
    }
    return { ok: true };
  }

  const { sms_limit, sms_used } = rows[0];
  if (sms_used >= sms_limit) {
    return {
      ok: false,
      statusCode: 429,
      body: {
        success: false,
        message: `SMS limiti dolub (${sms_used}/${sms_limit}). Muellimle elaqe saxlayin.`,
      },
    };
  }

  return { ok: true, remaining: sms_limit - sms_used };
}

module.exports = { checkSmsQuota };
