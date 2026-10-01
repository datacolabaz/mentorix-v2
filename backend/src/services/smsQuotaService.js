/**
 * SMS is retired platform-wide (email + in-app are the notification channels). Every caller that used
 * to check the monthly SMS quota now gets a stable "retired" refusal instead of a quota decision.
 * @returns {Promise<{ ok: false, statusCode: number, body: object }>}
 */
async function checkSmsQuota() {
  return {
    ok: false,
    statusCode: 410,
    body: {
      success: false,
      code: 'SMS_RETIRED',
      message: 'SMS xidməti dayandırılıb. Bildirişlər e-poçt və panel vasitəsilə göndərilir.',
    },
  };
}

module.exports = { checkSmsQuota };
