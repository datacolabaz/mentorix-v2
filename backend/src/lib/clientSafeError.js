/**
 * Map unexpected / Postgres errors to client-safe messages.
 * App-level 4xx errors (statusCode set) keep their message.
 */

const SERVER_ERROR_AZ = 'Server xətası. Zəhmət olmasa bir az sonra yenidən cəhd edin.';
const ONBOARDING_SAVE_FAILED_AZ =
  'Profili yadda saxlamaq alınmadı. Zəhmət olmasa bir az sonra yenidən cəhd edin.';

/** Postgres SQLSTATE codes are five alphanumeric characters (e.g. 42P10, 23505). */
function isPostgresError(err) {
  if (!err) return false;
  const code = String(err.code || '');
  if (/^[0-9A-Z]{5}$/.test(code)) return true;
  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('on conflict') ||
    msg.includes('duplicate key') ||
    msg.includes('violates unique constraint') ||
    msg.includes('violates foreign key') ||
    (msg.includes('relation ') && msg.includes(' does not exist'))
  );
}

function isClientError(err) {
  const status = Number(err?.statusCode || err?.status || 0) || 0;
  return status >= 400 && status < 500;
}

/**
 * @param {unknown} err
 * @param {{ fallbackMessage?: string, fallbackCode?: string }} [opts]
 * @returns {{ status: number, message: string, code?: string }}
 */
function toClientSafeError(err, opts = {}) {
  const fallbackMessage = opts.fallbackMessage || SERVER_ERROR_AZ;
  const fallbackCode = opts.fallbackCode || 'SERVER_ERROR';

  if (isClientError(err)) {
    return {
      status: Number(err.statusCode || err.status),
      message: String(err.message || fallbackMessage),
      code: err.code || undefined,
    };
  }

  if (isPostgresError(err)) {
    return {
      status: 500,
      message: fallbackMessage,
      code: fallbackCode,
    };
  }

  const status = Number(err?.statusCode || err?.status || 500) || 500;
  if (status >= 500 || isPostgresError(err)) {
    return { status: 500, message: fallbackMessage, code: fallbackCode };
  }

  return {
    status,
    message: String(err?.message || fallbackMessage),
    code: err?.code || fallbackCode,
  };
}

function toOnboardingClientError(err) {
  return toClientSafeError(err, {
    fallbackMessage: ONBOARDING_SAVE_FAILED_AZ,
    fallbackCode: 'ONBOARDING_SAVE_FAILED',
  });
}

module.exports = {
  isPostgresError,
  toClientSafeError,
  toOnboardingClientError,
  SERVER_ERROR_AZ,
  ONBOARDING_SAVE_FAILED_AZ,
};
