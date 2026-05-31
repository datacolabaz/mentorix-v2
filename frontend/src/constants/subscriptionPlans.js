export const DEFAULT_SUBSCRIPTION_PLANS = [
  {
    id: 'basic',
    title: 'SADƏ',
    price_azn: 0,
    highlight: false,
    items: ['5 tələbə', '5 SMS / ay', '5 MB Sənəd Yaddaşı'],
  },
  {
    id: 'pro',
    title: 'PRO',
    price_azn: 10,
    highlight: true,
    items: ['50 tələbə', '50 SMS / ay', '256 MB Sənəd Yaddaşı'],
  },
  {
    id: 'growth',
    title: 'GROWTH',
    price_azn: 20,
    highlight: false,
    items: ['100 tələbə', '100 SMS / ay', '1 GB Sənəd Yaddaşı'],
  },
  {
    id: 'premium',
    title: 'PREMIUM',
    price_azn: 30,
    highlight: false,
    items: ['Limitsiz tələbə', '200 SMS / Əlavə balans imkanı', '2 GB Sənəd Yaddaşı'],
  },
]

export function planPriceLabel(p) {
  const v = Number(p?.price_azn)
  if (!Number.isFinite(v)) return '—'
  return `${v} AZN/ay`
}
