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
    // null from API = unlimited; undefined = use fallback
    if (fromApi === null) return null
    return LIVE_PARTICIPANTS_BY_PLAN[id] ?? LIVE_PARTICIPANTS_BY_PLAN.basic
  }
  const n = Number(fromApi)
  return Number.isFinite(n) ? n : LIVE_PARTICIPANTS_BY_PLAN[id]
}

/** Live lesson count is unlimited; recording is package-controlled. */
export function livePlanMarketingLine(p) {
  const max = liveParticipantLimitForPlan(p)
  const participants =
    max == null ? 'Limitsiz iştirakçı' : `${max} iştirakçı`
  return `Limitsiz canlı dərslər · ${participants}`
}
