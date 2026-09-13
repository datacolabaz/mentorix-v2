const { normalizePlanSlug } = require('../config/plans');

/** Canlı dərs otağında eyni vaxtda maksimum iştirakçı (müəllim daxil deyil) */
const LIVE_PLAN_LIMITS = {
  basic: { maxParticipants: 5 },
  pro: { maxParticipants: 20 },
  growth: { maxParticipants: 50 },
  premium: { maxParticipants: null },
};

const LIVE_PARTICIPANT_LIMIT_MESSAGE =
  'Canlı dərs iştirakçı limitiniz dolub. Daha çox iştirakçı üçün paketinizi yeniləyin.';

function liveLimitsForPlan(planSlug) {
  const slug = normalizePlanSlug(planSlug);
  return LIVE_PLAN_LIMITS[slug] || LIVE_PLAN_LIMITS.basic;
}

function liveParticipantLimitLabel(planSlug) {
  const max = liveLimitsForPlan(planSlug).maxParticipants;
  if (max == null) return 'Limitsiz iştirakçı';
  return `${max} iştirakçı`;
}

/** Live lesson COUNT is unlimited; participants + recording are plan-gated. */
function liveMarketingLine(planSlug) {
  const max = liveLimitsForPlan(planSlug).maxParticipants;
  const participants = max == null ? 'Limitsiz iştirakçı' : `${max} iştirakçı`;
  return `Limitsiz canlı dərslər · ${participants}`;
}

module.exports = {
  LIVE_PLAN_LIMITS,
  LIVE_PARTICIPANT_LIMIT_MESSAGE,
  liveLimitsForPlan,
  liveParticipantLimitLabel,
  liveMarketingLine,
};
