/** Canonical UI locales shown in the language dropdown. */
export const UI_LOCALES = [
  { code: 'en', short: 'EN', nativeName: 'English', flag: '🇬🇧' },
  { code: 'az', short: 'AZ', nativeName: 'Azərbaycan', flag: '🇦🇿' },
  { code: 'ru', short: 'RU', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'tr', short: 'TR', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'de', short: 'DE', nativeName: 'Deutsch', flag: '🇩🇪' },
]

const CODES = new Set(UI_LOCALES.map((x) => x.code))

export function normalizeUiLocale(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace('_', '-')
  const primary = s.split('-')[0]
  if (CODES.has(primary)) return primary
  if (s.startsWith('ru')) return 'ru'
  if (s.startsWith('en')) return 'en'
  if (s.startsWith('tr')) return 'tr'
  if (s.startsWith('de')) return 'de'
  if (s.startsWith('az')) return 'az'
  return 'az'
}

export function uiLocaleMeta(code) {
  const n = normalizeUiLocale(code)
  return UI_LOCALES.find((x) => x.code === n) || UI_LOCALES[1]
}

export const UI_LOCALE_CODES = UI_LOCALES.map((x) => x.code)
