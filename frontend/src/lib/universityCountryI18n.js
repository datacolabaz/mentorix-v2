import { COUNTRY_SEARCH_ALIASES, UNIVERSITY_COUNTRIES } from './universityCountries'
import { COUNTRY_NAMES_RU } from '../locales/universityCountryNames.ru'

/** Canonical filter/API country keys (AZ) → ISO 3166-1 alpha-2 */
export const COUNTRY_ISO_CODES = {
  Almaniya: 'DE',
  'Böyük Britaniya': 'GB',
  İsveçrə: 'CH',
  Niderlandiya: 'NL',
  Polşa: 'PL',
  İtaliya: 'IT',
  Macarıstan: 'HU',
  Türkiyə: 'TR',
  Litva: 'LT',
  Latviya: 'LV',
  Estoniya: 'EE',
  Çexiya: 'CZ',
  Slovakiya: 'SK',
  Rumıniya: 'RO',
  Bolqarıstan: 'BG',
  Belçika: 'BE',
  Avstriya: 'AT',
  Fransa: 'FR',
  İspaniya: 'ES',
  Portuqaliya: 'PT',
  İsveç: 'SE',
  Finlandiya: 'FI',
  Norveç: 'NO',
  Danimarka: 'DK',
  Rusiya: 'RU',
  İrlandiya: 'IE',
  'Amerika Birləşmiş Ştatları': 'US',
  Kanada: 'CA',
}

const displayNamesCache = new Map()

function getDisplayNames(locale) {
  if (!displayNamesCache.has(locale)) {
    try {
      displayNamesCache.set(locale, new Intl.DisplayNames([locale], { type: 'region' }))
    } catch {
      displayNamesCache.set(locale, null)
    }
  }
  return displayNamesCache.get(locale)
}

export function resolveUiLocale(lang) {
  return String(lang || 'az').toLowerCase().startsWith('ru') ? 'ru' : 'az'
}

export function countryDisplayName(countryKey, lang = 'az') {
  const key = String(countryKey || '').trim()
  if (!key) return ''
  const locale = resolveUiLocale(lang)

  if (locale === 'ru') {
    const manual = COUNTRY_NAMES_RU[key]
    if (manual) return manual
  }

  const iso = COUNTRY_ISO_CODES[key]
  const dn = getDisplayNames(locale)
  if (iso && dn) {
    try {
      const name = dn.of(iso)
      if (name) return name
    } catch {
      /* ignore */
    }
  }

  return key
}

function foldAz(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ə/g, 'e')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
}

export function countryMatchesQuery(country, query, lang = 'az') {
  const q = foldAz(query).trim()
  if (!q) return true
  if (foldAz(country).includes(q)) return true
  const aliases = COUNTRY_SEARCH_ALIASES[country] || []
  if (aliases.some((alias) => foldAz(alias).includes(q) || q.includes(foldAz(alias)))) return true
  const localized = countryDisplayName(country, lang)
  if (localized && foldAz(localized).includes(q)) return true
  const iso = COUNTRY_ISO_CODES[country]
  if (iso && foldAz(iso).includes(q)) return true
  return false
}

export function filterCountriesByQuery(query, lang = 'az') {
  return UNIVERSITY_COUNTRIES.filter((country) => countryMatchesQuery(country, query, lang))
}
