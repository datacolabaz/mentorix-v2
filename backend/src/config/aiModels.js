/**
 * Anthropic model + AI feature config (env-only; never ship secrets to FE).
 * Prefer current official Claude API IDs — no retired models as defaults.
 */

const OPERATION = Object.freeze({
  QUESTION_GENERATION: 'QUESTION_GENERATION',
  ASSIGNMENT_GRADING: 'ASSIGNMENT_GRADING',
});

/** Claude Haiku 4.5 — fast / cost-efficient for question generation */
const DEFAULT_QUESTION_MODEL = 'claude-haiku-4-5';
/** Claude Sonnet 5 — higher quality for grading */
const DEFAULT_GRADING_MODEL = 'claude-sonnet-5';

/**
 * Rough list prices USD / MTok (docs overview). Used only for audit estimates.
 * Ops can override via env without code change.
 */
const MODEL_PRICE_USD_PER_MTOK = {
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-fable-5-1': { input: 10, output: 50 },
};

function envTrim(name) {
  const v = process.env[name];
  return v == null ? '' : String(v).trim();
}

function resolveQuestionModel() {
  return (
    envTrim('AI_QUESTION_MODEL') ||
    envTrim('ANTHROPIC_GENERATION_MODEL') ||
    DEFAULT_QUESTION_MODEL
  );
}

function resolveGradingModel() {
  return (
    envTrim('AI_GRADING_MODEL') ||
    envTrim('ANTHROPIC_OPEN_GRADING_MODEL') ||
    DEFAULT_GRADING_MODEL
  );
}

function resolveAnthropicApiKey() {
  return envTrim('ANTHROPIC_API_KEY');
}

function hasAnthropicKey() {
  return Boolean(resolveAnthropicApiKey());
}

function generationTimeoutMs() {
  const n = Number(process.env.ANTHROPIC_GENERATION_TIMEOUT_MS || 60000);
  return Number.isFinite(n) && n > 0 ? n : 60000;
}

function gradingTimeoutMs() {
  const n = Number(process.env.ANTHROPIC_OPEN_GRADING_TIMEOUT_MS || 45000);
  return Number.isFinite(n) && n > 0 ? n : 45000;
}

function generationMaxTokens() {
  const n = Number(process.env.ANTHROPIC_GENERATION_MAX_TOKENS || 4096);
  return Number.isFinite(n) && n > 0 ? n : 4096;
}

/**
 * @param {string} model
 * @param {{ prompt?: number, completion?: number, input?: number, output?: number }} usage
 * @returns {number|null}
 */
function estimateCostUsd(model, usage) {
  const key = String(model || '').trim();
  const prices =
    MODEL_PRICE_USD_PER_MTOK[key] ||
    MODEL_PRICE_USD_PER_MTOK[key.replace(/-\d{8}$/, '')] ||
    null;
  if (!prices) return null;
  const inputTok = Number(usage?.prompt ?? usage?.input ?? 0) || 0;
  const outputTok = Number(usage?.completion ?? usage?.output ?? 0) || 0;
  const usd = (inputTok / 1e6) * prices.input + (outputTok / 1e6) * prices.output;
  return Math.round(usd * 1e6) / 1e6;
}

/**
 * Localized “AI limit exhausted” copy (az / en / ru).
 * @param {'az'|'en'|'ru'|string} [locale]
 * @param {{ isTrial?: boolean }} [opts]
 */
function aiLimitExceededMessage(locale, { isTrial = false } = {}) {
  const lang = String(locale || 'az')
    .trim()
    .toLowerCase()
    .slice(0, 2);
  if (isTrial) {
    if (lang === 'en') return 'Your trial AI limit has been reached.';
    if (lang === 'ru') return 'Лимит ИИ пробного периода исчерпан.';
    return 'Sınaq AI limitiniz bitdi.';
  }
  if (lang === 'en') return 'Your monthly AI limit has been reached.';
  if (lang === 'ru') return 'Ваш месячный лимит ИИ исчерпан.';
  return 'Aylıq AI limitiniz bitdi.';
}

module.exports = {
  OPERATION,
  DEFAULT_QUESTION_MODEL,
  DEFAULT_GRADING_MODEL,
  MODEL_PRICE_USD_PER_MTOK,
  resolveQuestionModel,
  resolveGradingModel,
  resolveAnthropicApiKey,
  hasAnthropicKey,
  generationTimeoutMs,
  gradingTimeoutMs,
  generationMaxTokens,
  estimateCostUsd,
  aiLimitExceededMessage,
};
