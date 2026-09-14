/**
 * Single source of truth for package AI quotas (display + fallbacks).
 * Keep in sync with backend `config/plans.js` and migration `202_ai_credit_limits.sql`.
 * Slugs: basic→SADƏ, pro→STANDART, growth→PROFESSİONAL, premium→PREMİUM.
 */
export const AI_PLAN_LIMITS = Object.freeze({
  basic: Object.freeze({ questions: 20, gradings: 10 }),
  pro: Object.freeze({ questions: 100, gradings: 30 }),
  growth: Object.freeze({ questions: 300, gradings: 100 }),
  premium: Object.freeze({ questions: 800, gradings: 300 }),
})

export function resolveAiPlanLimits(planOrSlug) {
  const raw =
    typeof planOrSlug === 'string'
      ? planOrSlug
      : planOrSlug?.id || planOrSlug?.slug || ''
  const id = String(raw || '')
    .trim()
    .toLowerCase()
  const norm = id === 'business' || id === 'biznes' ? 'premium' : id
  const fromMap = AI_PLAN_LIMITS[norm] || AI_PLAN_LIMITS.basic
  const lim = typeof planOrSlug === 'object' && planOrSlug ? planOrSlug.limits || {} : {}
  const qRaw = lim.ai_questions_monthly
  const gRaw = lim.ai_gradings_monthly
  const questions =
    qRaw != null && Number.isFinite(Number(qRaw)) ? Math.max(0, Math.round(Number(qRaw))) : fromMap.questions
  const gradings =
    gRaw != null && Number.isFinite(Number(gRaw)) ? Math.max(0, Math.round(Number(gRaw))) : fromMap.gradings
  return { planId: norm || 'basic', questions, gradings, isTrial: (norm || 'basic') === 'basic' }
}
