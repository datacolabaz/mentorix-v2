/** Canonical UI language: az | ru | en | tr | de. */
import { normalizeUiLocale } from './uiLocales'

export function resolveUiLocale(lang) {
  return normalizeUiLocale(lang)
}

/** Intl locale tag for dates/numbers from i18n language. */
export function intlLocale(lang) {
  const l = resolveUiLocale(lang)
  if (l === 'ru') return 'ru-RU'
  if (l === 'en') return 'en-GB'
  if (l === 'tr') return 'tr-TR'
  if (l === 'de') return 'de-DE'
  return 'az-AZ'
}

export function intlCollatorLang(lang) {
  return resolveUiLocale(lang)
}

export function moneyLocale(lang) {
  const l = resolveUiLocale(lang)
  if (l === 'ru') return 'ru-RU'
  if (l === 'en') return 'en-GB'
  if (l === 'tr') return 'tr-TR'
  if (l === 'de') return 'de-DE'
  return 'az-Latn-AZ'
}
