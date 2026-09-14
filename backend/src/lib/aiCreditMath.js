/**
 * Pure helpers for AI credit period / remaining math (unit-testable, no DB).
 */

const { normalizePlanSlug } = require('../config/plans');

const AI_OPS = Object.freeze({
  QUESTION_GENERATION: 'QUESTION_GENERATION',
  ASSIGNMENT_GRADING: 'ASSIGNMENT_GRADING',
});

/**
 * @param {string} planSlug
 * @param {string} bakuYm YYYY-MM
 * @returns {string}
 */
function resolveAiPeriodKey(planSlug, bakuYm) {
  const slug = normalizePlanSlug(planSlug);
  if (slug === 'basic') return 'trial';
  return String(bakuYm || '').trim() || 'unknown';
}

/**
 * @param {{ ai_questions_monthly?: number|null, ai_gradings_monthly?: number|null }} limits
 * @param {'QUESTION_GENERATION'|'ASSIGNMENT_GRADING'} operation
 * @returns {number|null} null = unlimited
 */
function limitForOperation(limits, operation) {
  if (operation === AI_OPS.QUESTION_GENERATION) {
    return limits?.ai_questions_monthly == null ? null : Number(limits.ai_questions_monthly);
  }
  if (operation === AI_OPS.ASSIGNMENT_GRADING) {
    return limits?.ai_gradings_monthly == null ? null : Number(limits.ai_gradings_monthly);
  }
  return 0;
}

/**
 * @param {{ ai_questions_used?: number, ai_gradings_used?: number }} usage
 * @param {'QUESTION_GENERATION'|'ASSIGNMENT_GRADING'} operation
 */
function usedForOperation(usage, operation) {
  if (operation === AI_OPS.QUESTION_GENERATION) {
    return Math.max(0, Number(usage?.ai_questions_used) || 0);
  }
  return Math.max(0, Number(usage?.ai_gradings_used) || 0);
}

/**
 * @param {number|null} limit
 * @param {number} used
 * @param {number} [amount]
 */
function canConsume(limit, used, amount = 1) {
  const n = Math.max(1, Math.floor(Number(amount) || 1));
  if (limit == null || !Number.isFinite(Number(limit))) return true;
  const lim = Math.max(0, Number(limit));
  const u = Math.max(0, Number(used) || 0);
  return u + n <= lim;
}

/**
 * @param {number|null} limit
 * @param {number} used
 */
function remainingCredits(limit, used) {
  if (limit == null || !Number.isFinite(Number(limit))) return null;
  return Math.max(0, Number(limit) - (Math.max(0, Number(used) || 0)));
}

/**
 * @param {number|null} limit
 * @param {number} used
 * @param {number} [warnPct] remaining fraction threshold (default 0.2 = 80% used)
 */
function isNearLimit(limit, used, warnPct = 0.2) {
  if (limit == null || !Number.isFinite(Number(limit)) || Number(limit) <= 0) return false;
  const rem = remainingCredits(limit, used);
  if (rem == null) return false;
  return rem / Number(limit) <= warnPct;
}

module.exports = {
  AI_OPS,
  resolveAiPeriodKey,
  limitForOperation,
  usedForOperation,
  canConsume,
  remainingCredits,
  isNearLimit,
};
