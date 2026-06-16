/** Landing və paket kartları üçün marketinq mətnləri (slug: basic, pro, growth, premium). */

import { planPricingLimitLines } from './subscriptionPlanCopy'

export const PLAN_COMMON_FEATURES = [
  'Ödəniş izləmə',
  'İmtahan sistemi',
  'Tapşırıq sistemi',
  'Valideyn bildirişləri',
  'Xəritədə görünmə',
]

const PLAN_META = {
  basic: {
    subtitle: '14 günlük pulsuz sınaq',
    popularLabel: null,
    cta: '14 günlük sınağa başla',
    extraFeatures: [],
  },
  pro: {
    subtitle: null,
    popularLabel: '⭐ Ən populyar',
    cta: 'Standart seç',
    extraFeatures: [],
  },
  growth: {
    subtitle: null,
    popularLabel: null,
    cta: 'Professional seç',
    extraFeatures: ['Ətraflı hesabatlar'],
  },
  premium: {
    subtitle: null,
    popularLabel: null,
    cta: 'Premium seç',
    extraFeatures: ['Ətraflı hesabatlar', 'Prioritet texniki dəstək'],
  },
}

export function normalizePlanId(p) {
  const id = String(p?.id || p?.slug || '')
    .trim()
    .toLowerCase()
  if (id === 'business' || id === 'biznes') return 'premium'
  return id || 'basic'
}

export function getPlanMarketingMeta(p) {
  const id = normalizePlanId(p)
  return PLAN_META[id] || PLAN_META.basic
}

/** Landing qiymət kartı üçün tam siyahı (limitlər + platforma imkanları). */
export function landingPlanFeatureLines(p) {
  const meta = getPlanMarketingMeta(p)
  return [...planPricingLimitLines(p), ...PLAN_COMMON_FEATURES, ...meta.extraFeatures]
}

export function landingPlanPriceLabel(p) {
  const v = Number(p?.price_azn)
  if (!Number.isFinite(v) || v <= 0) return 'Pulsuz'
  return `${v} AZN / ay`
}
