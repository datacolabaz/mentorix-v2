/**
 * Public brand configuration shared by the Vite app, vite.config.js (index.html tokens)
 * and the Vercel functions in /api. Keep DEFAULT_BRAND in sync with backend/src/config/brand.js.
 *
 * The name stays "Mentorix" until the new public name is approved; switching is done with
 * env vars (BRAND_NAME / VITE_BRAND_NAME, BRAND_DOMAIN / VITE_BRAND_DOMAIN, ...).
 */
export const DEFAULT_BRAND = Object.freeze({
  name: 'Mentorix',
  domain: 'mentorix.io',
  legacyDomain: '',
  tagline: 'İmtahan yarat. Nəticəni gör. İnkişafı ölç.',
  description: 'Müəllim və təlimçilər üçün imtahan, qiymətləndirmə və nəticə analizi platforması.',
  previewTagline: 'İmtahan • Nəticə • Analitika',
  supportEmail: '',
})

const KEYS = {
  name: 'BRAND_NAME',
  domain: 'BRAND_DOMAIN',
  legacyDomain: 'LEGACY_DOMAIN',
  tagline: 'BRAND_TAGLINE',
  description: 'BRAND_DESCRIPTION',
  previewTagline: 'BRAND_PREVIEW_TAGLINE',
  supportEmail: 'SUPPORT_EMAIL',
}

/**
 * Accepts process.env, a loadEnv() result or an explicit object of VITE_* keys; VITE_-prefixed
 * keys win. Browser code must not pass import.meta.env whole (Vite would inline every VITE_* var).
 */
export function resolveBrand(env = {}) {
  const read = (key) => String(env?.[`VITE_${key}`] ?? env?.[key] ?? '').trim()
  const out = {}
  for (const [field, key] of Object.entries(KEYS)) out[field] = read(key) || DEFAULT_BRAND[field]
  out.domain = out.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  return Object.freeze(out)
}

/** Replaces __BRAND_*__ tokens (used in index.html). */
export function applyBrandTokens(text, brand) {
  return String(text)
    .replaceAll('__BRAND_NAME__', brand.name)
    .replaceAll('__BRAND_DOMAIN__', brand.domain)
    .replaceAll('__BRAND_TAGLINE__', brand.tagline)
    .replaceAll('__BRAND_DESCRIPTION__', brand.description)
}
