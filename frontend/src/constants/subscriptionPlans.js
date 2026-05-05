export const DEFAULT_SUBSCRIPTION_PLANS = [
  { id: 'basic', title: 'BASIC', price_azn: 6, highlight: false, items: ['20 students', '1GB storage', '30 SMS'] },
  { id: 'pro', title: 'PRO', price_azn: 10, highlight: true, items: ['100 students', '5GB storage', '200 SMS'] },
  { id: 'business', title: 'BUSINESS', price_azn: 19, highlight: false, items: ['Unlimited students', '20GB storage', '500 SMS'] },
]

export function planPriceLabel(p) {
  const v = Number(p?.price_azn)
  if (!Number.isFinite(v)) return '—'
  return `${v} AZN/ay`
}

