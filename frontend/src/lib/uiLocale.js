/** Canonical UI language: az | ru | en. */
export function resolveUiLocale(lang) {
  const l = String(lang || 'az').toLowerCase()
  if (l.startsWith('ru')) return 'ru'
  if (l.startsWith('en')) return 'en'
  return 'az'
}

/** Intl locale tag for dates/numbers from i18n language (az | ru | en). */
export function intlLocale(lang) {
  const l = resolveUiLocale(lang)
  if (l === 'ru') return 'ru-RU'
  if (l === 'en') return 'en-GB'
  return 'az-AZ'
}

export function intlCollatorLang(lang) {
  return resolveUiLocale(lang)
}

export function moneyLocale(lang) {
  const l = resolveUiLocale(lang)
  if (l === 'ru') return 'ru-RU'
  if (l === 'en') return 'en-GB'
  return 'az-Latn-AZ'
}
