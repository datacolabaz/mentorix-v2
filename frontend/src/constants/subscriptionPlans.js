export const DEFAULT_SUBSCRIPTION_PLANS = [
  { id: 'basic', title: 'SADƏ', price_azn: 0, highlight: false, items: [] },
  { id: 'pro', title: 'PRO', price_azn: 10, highlight: true, items: [] },
  { id: 'business', title: 'BİZNES', price_azn: 19, highlight: false, items: [] },
]

export function planPriceLabel(p) {
  const v = Number(p?.price_azn)
  if (!Number.isFinite(v)) return '—'
  return `${v} AZN/ay`
}

