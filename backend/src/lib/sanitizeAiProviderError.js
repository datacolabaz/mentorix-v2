/**
 * Map OpenAI / provider API failures to teacher-safe localized messages.
 * Never expose billing, API keys, or raw provider text to instructors.
 */

const MESSAGES = {
  unavailable: {
    az: 'AI xidməti hazırda əlçatan deyil. Bir az sonra yenidən cəhd edin və ya əl ilə qiymətləndirin.',
    en: 'The AI service is currently unavailable. Please try again later or grade manually.',
    ru: 'Сервис ИИ сейчас недоступен. Попробуйте позже или оцените вручную.',
  },
  rate_limit: {
    az: 'AI xidmətinə çox müraciət var. Bir az sonra yenidən cəhd edin və ya əl ilə qiymətləndirin.',
    en: 'The AI service is busy right now. Please try again later or grade manually.',
    ru: 'Сервис ИИ сейчас перегружен. Попробуйте позже или оцените вручную.',
  },
  generic: {
    az: 'AI təklifi alınmadı. Bir az sonra yenidən cəhd edin və ya əl ilə qiymətləndirin.',
    en: 'Could not get an AI suggestion. Please try again later or grade manually.',
    ru: 'Не удалось получить предложение ИИ. Попробуйте позже или оцените вручную.',
  },
};

function normalizeLang(locale) {
  const s = String(locale || '')
    .trim()
    .toLowerCase();
  if (s.startsWith('ru')) return 'ru';
  if (s.startsWith('en')) return 'en';
  return 'az';
}

function pickMessage(kind, locale) {
  const table = MESSAGES[kind] || MESSAGES.generic;
  return table[normalizeLang(locale)] || table.az;
}

/**
 * True when the error came from (or looks like) an OpenAI/provider failure
 * that must not be shown raw to teachers.
 */
function isAiProviderError(err) {
  if (!err) return false;
  if (err.name === 'OpenAiReviewError' || err.rawProvider) return true;
  if (err.status || err.statusCode) return true;
  const code = String(err.code || '').toLowerCase();
  if (
    code === 'insufficient_quota' ||
    code === 'rate_limit_exceeded' ||
    code === 'invalid_api_key' ||
    code === 'account_deactivated'
  ) {
    return true;
  }
  const message = String(err.message || '').toLowerCase();
  return (
    message.includes('openai') ||
    message.includes('credits remaining') ||
    message.includes('insufficient_quota') ||
    message.includes('exceeded your current quota') ||
    message.includes('rate limit') ||
    message.includes('api key') ||
    message.includes('platform.openai.com') ||
    message.includes('billing')
  );
}

/**
 * @param {{ status?: number, code?: string, message?: string, type?: string } | Error | null | undefined} err
 * @returns {'unavailable'|'rate_limit'|'generic'}
 */
function classifyAiProviderError(err) {
  const status = Number(err?.status ?? err?.statusCode ?? err?.rawProvider?.status ?? 0) || 0;
  const code = String(err?.code || err?.error?.code || err?.rawProvider?.code || '').toLowerCase();
  const type = String(err?.type || err?.error?.type || err?.rawProvider?.type || '').toLowerCase();
  const message = String(
    err?.message || err?.error?.message || err?.rawProvider?.message || err || '',
  ).toLowerCase();

  const billingHints =
    code === 'insufficient_quota' ||
    type === 'insufficient_quota' ||
    message.includes('insufficient_quota') ||
    message.includes('no credits remaining') ||
    message.includes('exceeded your current quota') ||
    message.includes('billing') ||
    message.includes('payment required') ||
    message.includes('platform.openai.com') ||
    status === 402;

  if (billingHints || status === 401 || status === 403) {
    return 'unavailable';
  }

  if (
    status === 429 ||
    code === 'rate_limit_exceeded' ||
    type.includes('rate_limit') ||
    message.includes('rate limit') ||
    message.includes('too many requests')
  ) {
    return 'rate_limit';
  }

  if (status >= 500 || status === 503) {
    return 'unavailable';
  }

  return 'generic';
}

/**
 * @param {{ status?: number, code?: string, message?: string, type?: string } | Error | null | undefined} err
 * @param {string} [locale]
 * @returns {{ code: string, message: string, kind: string }}
 */
function sanitizeAiProviderError(err, locale = 'az') {
  const kind = classifyAiProviderError(err);
  const code =
    kind === 'unavailable'
      ? 'AI_SERVICE_UNAVAILABLE'
      : kind === 'rate_limit'
        ? 'AI_RATE_LIMIT'
        : 'AI_SUGGEST_FAILED';
  return {
    code,
    kind,
    message: pickMessage(kind, locale),
  };
}

/**
 * App-level errors keep their message; provider errors are always sanitized.
 * @param {unknown} err
 * @param {string} [locale]
 */
function toTeacherAiError(err, locale = 'az') {
  if (isAiProviderError(err)) {
    return sanitizeAiProviderError(err, locale);
  }
  const fallback = pickMessage('generic', locale);
  const message = String(err?.message || '').trim() || fallback;
  return {
    code: 'AI_SUGGEST_FAILED',
    kind: 'app',
    message,
  };
}

module.exports = {
  classifyAiProviderError,
  sanitizeAiProviderError,
  isAiProviderError,
  toTeacherAiError,
  pickMessage,
};
