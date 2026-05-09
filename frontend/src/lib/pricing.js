/** Yearly invoice = 12 × monthly − 20% */
export const YEARLY_DISCOUNT = 0.2

export function yearlyTotalAzn(monthlyAzn, discount = YEARLY_DISCOUNT) {
  const m = Number(monthlyAzn || 0) || 0
  const d = Number(discount) || 0
  return Math.round(m * 12 * (1 - Math.min(1, Math.max(0, d))) * 100) / 100
}

export function formatAzn(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n))
  return n.toFixed(2)
}
