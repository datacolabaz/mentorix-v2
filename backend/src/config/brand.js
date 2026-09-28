'use strict';

/**
 * Central public brand configuration. The public product name stays "Mentorix"
 * until the new name is approved; switching is an env change (BRAND_NAME=Resulio,
 * BRAND_DOMAIN=...), not a code change. Internal identifiers (tables, env names,
 * mentorix_* keys, API paths) are intentionally not driven by this config.
 */
const DEFAULT_BRAND = Object.freeze({
  name: 'Mentorix',
  domain: 'mentorix.io',
  legacyDomain: '',
  tagline: 'İmtahan yarat. Nəticəni gör. İnkişafı ölç.',
  description: 'Müəllim və təlimçilər üçün imtahan, qiymətləndirmə və nəticə analizi platforması.',
  previewTagline: 'İmtahan • Nəticə • Analitika',
  supportEmail: '',
  noreplyEmail: '',
});

function env(key) {
  const v = process.env[key];
  return v == null ? '' : String(v).trim();
}

function getBrand() {
  const domain = env('BRAND_DOMAIN').replace(/^https?:\/\//, '').replace(/\/+$/, '') || DEFAULT_BRAND.domain;
  return Object.freeze({
    name: env('BRAND_NAME') || DEFAULT_BRAND.name,
    domain,
    legacyDomain: env('LEGACY_DOMAIN') || DEFAULT_BRAND.legacyDomain,
    tagline: env('BRAND_TAGLINE') || DEFAULT_BRAND.tagline,
    description: env('BRAND_DESCRIPTION') || DEFAULT_BRAND.description,
    previewTagline: env('BRAND_PREVIEW_TAGLINE') || DEFAULT_BRAND.previewTagline,
    supportEmail: env('SUPPORT_EMAIL') || DEFAULT_BRAND.supportEmail,
    noreplyEmail: env('NOREPLY_EMAIL') || DEFAULT_BRAND.noreplyEmail,
  });
}

module.exports = { DEFAULT_BRAND, getBrand };
