/** Landing və paket kartları üçün marketinq mətnləri (admin paneldən idarə olunur). */

import { AI_PLAN_LIMITS } from '../constants/aiPlanLimits'
import { planPricingLimitLines } from './subscriptionPlanCopy'

const LIVE_LESSON_LINE = 'Google Meet və Zoom linkləri ilə limitsiz canlı dərs planlama'

const BASIC_TRIAL_LANDING_LINES = [
  'Kredit kartı tələb olunmur',
  'Sınaq bitdikdə avtomatik ödəniş tutulmur',
  'İstənilən vaxt dayandıra bilərsiniz',
  '5 tələbə',
  '3 imtahan',
  '5 tapşırıq',
  `${AI_PLAN_LIMITS.basic.questions} AI sual`,
  `${AI_PLAN_LIMITS.basic.gradings} AI ilə yoxlanılan açıq-cavab işi`,
  '1 GB bulud yaddaşı',
  'Google Meet və Zoom linki ilə canlı dərs planlama',
  'Məhdud e-poçt bildirişləri',
]

const PAID_COMMON = ['Ödəniş izləmə', 'Valideyn e-poçt bildirişləri', 'Ətraflı hesabatlar']

const FALLBACK_MARKETING_BY_SLUG = {
  basic: ['Google Meet və Zoom linki ilə canlı dərs planlama', 'Məhdud e-poçt bildirişləri'],
  pro: ['Ödəniş izləmə', 'Valideyn e-poçt bildirişləri', LIVE_LESSON_LINE],
  growth: [...PAID_COMMON, 'Qrup və fərdi çat', LIVE_LESSON_LINE, 'QR ilə doğrulana bilən sertifikat'],
  premium: [...PAID_COMMON, 'Prioritet dəstək', LIVE_LESSON_LINE, 'QR ilə doğrulana bilən sertifikat'],
}

const FALLBACK_META_BY_SLUG = {
  basic: {
    subtitle: 'Mentorix-in əsas imkanlarını 21 gün ödənişsiz yoxlayın.',
    popularLabel: null,
    cta: 'Pulsuz başla',
  },
  pro: {
    subtitle: 'Köhnə paket — mövcud abunəçilər üçün',
    popularLabel: null,
    cta: 'Planı seç',
  },
  growth: {
    subtitle: 'Böyüyən qrupları idarə edən müəllimlər üçün.',
    popularLabel: null,
    cta: 'Planı seç',
  },
  premium: {
    subtitle: 'Aktiv müəllimlər və daha böyük tədris qrupları üçün.',
    popularLabel: null,
    cta: 'Planı seç',
  },
}

export function normalizePlanId(p) {
  const id = String(p?.id || p?.slug || '')
    .trim()
    .toLowerCase()
  if (id === 'business' || id === 'biznes') return 'premium'
  if (id === 'professional') return 'growth'
  return id || 'basic'
}

/** Admin-edited marketing lines, minus anything that describes retired SMS or internal-video features. */
const RETIRED_FEATURE_RE = /\bSMS\b|iştirakçı|participant|участник|\bYazı:|recording|запис/i

export function planMarketingFeatures(p) {
  const fromApi = Array.isArray(p?.marketing_features) ? p.marketing_features : null
  if (fromApi?.length) {
    return fromApi.map((x) => String(x || '').trim()).filter((x) => x && !RETIRED_FEATURE_RE.test(x))
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
  const limits = planPricingLimitLines(p)
  const marketing = planMarketingFeatures(p).filter(
    (line) => !/\b(AI\s*sual|AI\s*Tapşırıq|AI\s*ilə|AI\s*question|AI\s*grading|ИИ-)/i.test(String(line)) && line !== LIVE_LESSON_LINE,
  )
  return [...limits, ...marketing]
}

export function landingPlanPriceLabel(p) {
  const v = Number(p?.price_azn)
  if (!Number.isFinite(v) || v <= 0) return '0 AZN / 21 gün'
  return `${v} AZN / ay`
}
