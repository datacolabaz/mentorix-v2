/**
 * Social-proof data for the public homepage. Every list is intentionally empty: only add entries that
 * the product owner has confirmed (real names with written consent, real counts from production data,
 * logos with permission). Empty lists render nothing in production.
 *
 * testimonials: { quote, name, role, organization }
 * stats:        { value, label, source }   e.g. { value: '1 200+', label: 'yaradılmış test', source: 'DB, 2026-09' }
 * logos:        { name, src, href? }
 */
export const TRUST_CONTENT = Object.freeze({
  testimonials: [],
  stats: [],
  logos: [],
})
