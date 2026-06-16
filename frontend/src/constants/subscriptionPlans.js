export const DEFAULT_SUBSCRIPTION_PLANS = [
  {
    id: 'basic',
    title: 'SADƏ',
    price_azn: 0,
    highlight: false,
    items: ['5 tələbə', '5 SMS / ay', '5 MB Sənəd Yaddaşı'],
    limits: {
      students: 5,
      storage_limit_bytes: 5 * 1024 * 1024,
      sms_monthly: 5,
      exams_monthly: 2,
      homeworks_monthly: 5,
    },
  },
  {
    id: 'pro',
    title: 'PRO',
    price_azn: 10,
    highlight: true,
    items: ['50 tələbə', '50 SMS / ay', '256 MB Sənəd Yaddaşı'],
    limits: {
      students: 50,
      storage_limit_bytes: 256 * 1024 * 1024,
      sms_monthly: 50,
      exams_monthly: 20,
      homeworks_monthly: 40,
    },
  },
  {
    id: 'growth',
    title: 'GROWTH',
    price_azn: 20,
    highlight: false,
    items: ['100 tələbə', '100 SMS / ay', '1 GB Sənəd Yaddaşı'],
    limits: {
      students: 100,
      storage_limit_bytes: 1024 * 1024 * 1024,
      sms_monthly: 100,
      exams_monthly: 50,
      homeworks_monthly: 120,
    },
  },
  {
    id: 'premium',
    title: 'PREMIUM',
    price_azn: 30,
    highlight: false,
    items: ['Limitsiz tələbə', '200 SMS / Əlavə balans imkanı', '2 GB Sənəd Yaddaşı'],
    limits: {
      students: null,
      storage_limit_bytes: 2048 * 1024 * 1024,
      sms_monthly: 200,
      exams_monthly: null,
      homeworks_monthly: null,
    },
  },
]

export function planPriceLabel(p) {
  const v = Number(p?.price_azn)
  if (!Number.isFinite(v)) return '—'
  return `${v} AZN/ay`
}
