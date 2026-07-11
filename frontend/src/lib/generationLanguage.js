/** @typedef {'az' | 'ru' | 'en'} GenerationLanguage */

/**
 * Maps the active UI locale to a supported generation language code.
 * Unknown values fall back to az (never English unless explicitly en).
 *
 * @param {unknown} i18nLanguage
 * @returns {GenerationLanguage}
 */
export function normalizeGenerationLanguage(i18nLanguage) {
  const code = String(i18nLanguage ?? '')
    .trim()
    .toLowerCase()
    .split('-')[0]
  if (code === 'ru' || code === 'en') return code
  return 'az'
}
