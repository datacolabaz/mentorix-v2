/** Landing və paket kartları üçün marketinq mətnləri (admin paneldən idarə olunur). */

import { planPricingLimitLines } from './subscriptionPlanCopy'

const BASIC_TRIAL_LANDING_LINES = [
  'Bütün funksiyaları 21 gün tam sına',
  'Kredit kartı tələb olunmur',
  'İstənilən vaxt ləğv et',
  'Limitsiz canlı dərslər · 5 iştirakçı',
]

const FALLBACK_MARKETING_BY_SLUG = {
  basic: ['Ödəniş izləmə', 'Valideyn bildirişləri', 'Xəritədə görünmə', 'Limitsiz canlı dərslər', 'Mentorix Live (5 iştirakçı)'],
  pro: ['Ödəniş izləmə', 'Valideyn bildirişləri', 'Xəritədə görünmə', 'Limitsiz canlı dərslər', 'Mentorix Live (20 iştirakçı)', 'Yazı: 5 saat/ay'],
  growth: [
    'Ödəniş izləmə',
    'Valideyn bildirişləri',
    'Xəritədə görünmə',
    'Ətraflı hesabatlar',
    'Limitsiz canlı dərslər',
    'Mentorix Live (50 iştirakçı)',
    'Yazı: 20 saat/ay',
  ],
  premium: [
    'Ödəniş izləmə',
    'Valideyn bildirişləri',
    'Xəritədə görünmə',
    'Ətraflı hesabatlar',
    'Prioritet texniki dəstək',
    'Limitsiz canlı dərslər',
    'Mentorix Live (limitsiz)',
    'Yazı: 50 saat/ay',
  ],
}

const FALLBACK_META_BY_SLUG = {
  basic: {
    subtitle: 'Müəllimlər üçün — 21 günlük pulsuz sınaq',
    popularLabel: null,
    cta: '21 günlük sınağa başla',
  },
  pro: {
    subtitle: 'Fərdi müəllimlər üçün',
    popularLabel: '⭐ Ən populyar',
    cta: 'Planı seç',
  },
  growth: {
    subtitle: 'Böyüyən müəllimlər üçün',
    popularLabel: null,
    cta: 'Planı seç',
  },
  premium: {
    subtitle: 'Aktiv müəllimlər üçün',
    popularLabel: null,
    cta: 'Planı seç',
  },
}

export function normalizePlanId(p) {
  const id = String(p?.id || p?.slug || '')
    .trim()
    .toLowerCase()
  if (id === 'business' || id === 'biznes') return 'premium'
  return id || 'basic'
}

export function planMarketingFeatures(p) {
  const fromApi = Array.isArray(p?.marketing_features) ? p.marketing_features : null
  if (fromApi?.length) {
    return fromApi.map((x) => String(x || '').trim()).filter(Boolean)
  }
  const id = normalizePlanId(p)
  return FALLBACK_MARKETING_BY_SLUG[id] || FALLBACK_MARKETING_BY_SLUG.basic
}

export function getPlanMarketingMeta(p) {
  const id = normalizePlanId(p)
  const fallback = FALLBACK_META_BY_SLUG[id] || FALLBACK_META_BY_SLUG.basic
  const subtitle =
    p?.plan_subtitle != null && String(p.plan_subtitle).trim() !== ''
      ? String(p.plan_subtitle).trim()
      : fallback.subtitle
  const popularLabel =
    p?.popular_label != null && String(p.popular_label).trim() !== ''
      ? String(p.popular_label).trim()
      : fallback.popularLabel
  const cta =
    p?.plan_cta != null && String(p.plan_cta).trim() !== '' ? String(p.plan_cta).trim() : fallback.cta
  return { subtitle, popularLabel, cta }
}

/** Landing qiymət kartı üçün tam siyahı (limitlər + admin imkanları). */
export function landingPlanFeatureLines(p) {
  if (normalizePlanId(p) === 'basic') {
    return BASIC_TRIAL_LANDING_LINES
  }
  return [...planPricingLimitLines(p), ...planMarketingFeatures(p)]
}

export function landingPlanPriceLabel(p) {
  const v = Number(p?.price_azn)
  if (!Number.isFinite(v) || v <= 0) return 'Pulsuz'
  return `${v} AZN / ay`
}
