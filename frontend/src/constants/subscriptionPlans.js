import { AI_PLAN_LIMITS } from './aiPlanLimits'

const GB = 1024 * 1024 * 1024

/** Offline fallback for the three public plans (source of truth: /api/public/subscription-plans). */
export const DEFAULT_SUBSCRIPTION_PLANS = [
  {
    id: 'basic',
    title: 'PULSUZ SINAQ',
    price_azn: 0,
    highlight: false,
    items: [],
    limits: {
      students: 5,
      storage_limit_bytes: 1 * GB,
      exams_monthly: 3,
      homeworks_monthly: 5,
      ai_questions_monthly: AI_PLAN_LIMITS.basic.questions,
      ai_gradings_monthly: AI_PLAN_LIMITS.basic.gradings,
    },
    marketing_features: ['Google Meet və Zoom linki ilə canlı dərs planlama', 'Məhdud e-poçt bildirişləri'],
    plan_subtitle: 'Mentorix-in əsas imkanlarını 21 gün ödənişsiz yoxlayın.',
    plan_cta: 'Pulsuz başla',
    popular_label: null,
  },
  {
    id: 'growth',
    title: 'PROFESSIONAL',
    price_azn: 10,
    highlight: true,
    items: [],
    limits: {
      students: 50,
      storage_limit_bytes: 20 * GB,
      exams_monthly: 50,
      homeworks_monthly: 120,
      ai_questions_monthly: AI_PLAN_LIMITS.growth.questions,
      ai_gradings_monthly: AI_PLAN_LIMITS.growth.gradings,
    },
    marketing_features: [
      'Ödəniş izləmə',
      'Valideyn e-poçt bildirişləri',
      'Ətraflı hesabatlar',
      'Qrup və fərdi çat',
      'Google Meet və Zoom linkləri ilə limitsiz canlı dərs planlama',
      'QR ilə doğrulana bilən sertifikat',
    ],
    plan_subtitle: 'Böyüyən qrupları idarə edən müəllimlər üçün.',
    plan_cta: 'Planı seç',
    popular_label: null,
  },
  {
    id: 'premium',
    title: 'PREMIUM',
    price_azn: 19,
    highlight: false,
    items: [],
    limits: {
      students: null,
      storage_limit_bytes: 50 * GB,
      exams_monthly: null,
      homeworks_monthly: null,
      ai_questions_monthly: AI_PLAN_LIMITS.premium.questions,
      ai_gradings_monthly: AI_PLAN_LIMITS.premium.gradings,
    },
    marketing_features: [
      'Ödəniş izləmə',
      'Valideyn e-poçt bildirişləri',
      'Ətraflı hesabatlar',
      'Prioritet dəstək',
      'Google Meet və Zoom linkləri ilə limitsiz canlı dərs planlama',
      'QR ilə doğrulana bilən sertifikat',
    ],
    plan_subtitle: 'Aktiv müəllimlər və daha böyük tədris qrupları üçün.',
    plan_cta: 'Planı seç',
    popular_label: null,
  },
]

export function planPriceLabel(p) {
  const v = Number(p?.price_azn)
  if (!Number.isFinite(v) || v <= 0) return 'Pulsuz'
  return `${v} AZN / ay`
}
