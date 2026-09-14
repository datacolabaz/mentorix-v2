const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyAiProviderError,
  sanitizeAiProviderError,
  isAiProviderError,
  toTeacherAiError,
} = require('./sanitizeAiProviderError');

describe('sanitizeAiProviderError', () => {
  it('maps insufficient_quota / no credits to unavailable (az)', () => {
    const out = sanitizeAiProviderError(
      { status: 429, code: 'insufficient_quota', message: 'You have no credits remaining. Add credits…' },
      'az',
    );
    assert.equal(out.code, 'AI_SERVICE_UNAVAILABLE');
    assert.match(out.message, /əlçatan deyil/);
    assert.doesNotMatch(out.message, /credits|openai|billing/i);
  });

  it('maps rate limit separately', () => {
    const out = sanitizeAiProviderError(
      { status: 429, code: 'rate_limit_exceeded', message: 'Rate limit exceeded' },
      'en',
    );
    assert.equal(out.code, 'AI_RATE_LIMIT');
    assert.match(out.message, /busy|try again/i);
  });

  it('maps auth failures to unavailable without leaking details', () => {
    const out = sanitizeAiProviderError(
      { status: 401, message: 'Incorrect API key provided: sk-***' },
      'ru',
    );
    assert.equal(out.code, 'AI_SERVICE_UNAVAILABLE');
    assert.doesNotMatch(out.message, /sk-|api key|openai/i);
  });

  it('maps generic 400-class provider errors safely', () => {
    const out = sanitizeAiProviderError(
      { status: 400, message: 'Invalid request about model xyz' },
      'en',
    );
    assert.equal(out.code, 'AI_SUGGEST_FAILED');
    assert.doesNotMatch(out.message, /Invalid request|model xyz/i);
  });

  it('classify detects billing phrasing without code', () => {
    assert.equal(
      classifyAiProviderError({ message: 'You have no credits remaining' }),
      'unavailable',
    );
  });

  it('keeps app-level errors for teachers', () => {
    const err = new Error('Təhlil üçün mətn və ya PDF/DOCX faylı tapılmadı');
    assert.equal(isAiProviderError(err), false);
    const out = toTeacherAiError(err, 'az');
    assert.equal(out.message, err.message);
  });

  it('sanitizes OpenAiReviewError even without quota code', () => {
    const err = new Error('You have no credits remaining');
    err.name = 'OpenAiReviewError';
    err.status = 429;
    err.code = 'insufficient_quota';
    assert.equal(isAiProviderError(err), true);
    const out = toTeacherAiError(err, 'az');
    assert.equal(out.code, 'AI_SERVICE_UNAVAILABLE');
    assert.doesNotMatch(out.message, /credits/i);
  });
});
