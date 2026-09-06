/** Intl locale tag for dates/numbers from i18n language (az | ru | en). */
export function intlLocale(lang) {
  const l = String(lang || '').toLowerCase()
  if (l.startsWith('ru')) return 'ru-RU'
  if (l.startsWith('en')) return 'en-GB'
  return 'az-AZ'
}

export function intlCollatorLang(lang) {
  const l = String(lang || '').toLowerCase()
  if (l.startsWith('ru')) return 'ru'
  if (l.startsWith('en')) return 'en'
  return 'az'
}

export function moneyLocale(lang) {
  const l = String(lang || '').toLowerCase()
  if (l.startsWith('ru')) return 'ru-RU'
  if (l.startsWith('en')) return 'en-GB'
  return 'az-Latn-AZ'
}
