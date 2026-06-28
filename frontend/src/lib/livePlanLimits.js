/** Mentorix Live plan limitləri (frontend göstərişi). */

import { normalizePlanId } from './subscriptionPlanMarketing'

const LIVE_PARTICIPANTS_BY_PLAN = {
  basic: 5,
  pro: 20,
  growth: 50,
  premium: null,
}

export function liveParticipantLimitForPlan(p) {
  const id = normalizePlanId(p)
  const fromApi = p?.limits?.live_participants
  if (fromApi === null || fromApi === undefined) {
    return LIVE_PARTICIPANTS_BY_PLAN[id] ?? LIVE_PARTICIPANTS_BY_PLAN.basic
  }
  const n = Number(fromApi)
  return Number.isFinite(n) ? n : LIVE_PARTICIPANTS_BY_PLAN[id]
}

export function livePlanMarketingLine(p) {
  const max = liveParticipantLimitForPlan(p)
  if (max == null) return 'Canlı dərs — Limitsiz iştirakçı · Record: ✓ (local)'
  return `Canlı dərs — ${max} iştirakçı · Record: ✓ (local)`
}
