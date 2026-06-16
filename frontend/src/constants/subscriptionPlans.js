export const DEFAULT_SUBSCRIPTION_PLANS = [
  {
    id: 'basic',
    title: 'SADƏ',
    price_azn: 0,
    highlight: false,
    items: [],
    limits: {
      students: 5,
      documents: 50,
      storage_limit_bytes: 5 * 1024 * 1024,
      sms_monthly: 5,
      exams_monthly: 2,
      homeworks_monthly: 5,
    },
  },
  {
    id: 'pro',
    title: 'STANDART',
    price_azn: 5,
    highlight: true,
    items: [],
    limits: {
      students: 20,
      documents: 1250,
      storage_limit_bytes: 128 * 1024 * 1024,
      sms_monthly: 20,
      exams_monthly: 20,
      homeworks_monthly: 40,
    },
  },
  {
    id: 'growth',
    title: 'PROFESSİONAL',
    price_azn: 10,
    highlight: false,
    items: [],
    limits: {
      students: 50,
      documents: 5000,
      storage_limit_bytes: 512 * 1024 * 1024,
      sms_monthly: 50,
      exams_monthly: 50,
      homeworks_monthly: 120,
    },
  },
  {
    id: 'premium',
    title: 'PREMİUM',
    price_azn: 19,
    highlight: false,
    items: [],
    limits: {
      students: null,
      documents: null,
      storage_limit_bytes: null,
      sms_monthly: 200,
      exams_monthly: null,
      homeworks_monthly: null,
    },
  },
]

export function planPriceLabel(p) {
  const v = Number(p?.price_azn)
  if (!Number.isFinite(v) || v <= 0) return 'Pulsuz'
  return `${v} AZN / ay`
}
