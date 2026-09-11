import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import az from '../locales/az/translation.json'
import ru from '../locales/ru/translation.json'
import en from '../locales/en/translation.json'
import { universityCatalogAz, universityCatalogEn, universityCatalogRu } from '../locales/universityCatalog'
import { publicLandingsAz, publicLandingsEn, publicLandingsRu } from '../locales/publicLandings'
import { normalizeUiLocale, UI_LOCALE_CODES } from '../lib/uiLocales'

function withUniversityCatalog(base, catalog) {
  return {
    ...base,
    universitySearch: {
      ...base.universitySearch,
      catalog,
    },
  }
}

const azResources = { ...withUniversityCatalog(az, universityCatalogAz), ...publicLandingsAz }
const ruResources = { ...withUniversityCatalog(ru, universityCatalogRu), ...publicLandingsRu }
const enResources = { ...withUniversityCatalog(en, universityCatalogEn), ...publicLandingsEn }

export const LOCALE_KEY = 'mentorix_lang'
const LEGACY_LOCALE_KEY = 'mentorix_locale_v1'

export function readStoredLocale() {
  try {
    const v =
      String(localStorage.getItem(LOCALE_KEY) || localStorage.getItem(LEGACY_LOCALE_KEY) || '')
        .trim()
        .toLowerCase()
    return normalizeUiLocale(v)
  } catch {
    return 'az'
  }
}

export function writeStoredLocale(locale) {
  try {
    const next = normalizeUiLocale(locale)
    localStorage.setItem(LOCALE_KEY, next)
    localStorage.removeItem(LEGACY_LOCALE_KEY)
  } catch {
    /* ignore */
  }
}

export function applyDocumentLocale(locale) {
  if (typeof document === 'undefined') return
  const lang = normalizeUiLocale(locale)
  document.documentElement.lang = lang
}

const detector = new LanguageDetector()
detector.init({
  order: ['localStorage', 'navigator'],
  lookupLocalStorage: LOCALE_KEY,
  caches: ['localStorage'],
})

const initialLocale = readStoredLocale()
applyDocumentLocale(initialLocale)

i18n
  .use(detector)
  .use(initReactI18next)
  .init({
    resources: {
      az: { translation: azResources },
      ru: { translation: ruResources },
      en: { translation: enResources },
      tr: { translation: enResources },
      de: { translation: enResources },
    },
    lng: initialLocale,
    fallbackLng: {
      tr: ['en', 'az'],
      de: ['en', 'az'],
      default: ['az'],
    },
    supportedLngs: UI_LOCALE_CODES,
    interpolation: { escapeValue: false },
    returnEmptyString: false,
  })
  .then(() => {
    i18n.addResourceBundle('az', 'translation', { universitySearch: { catalog: universityCatalogAz } }, true, true)
    i18n.addResourceBundle('ru', 'translation', { universitySearch: { catalog: universityCatalogRu } }, true, true)
    i18n.addResourceBundle('en', 'translation', { universitySearch: { catalog: universityCatalogEn } }, true, true)
  })

export default i18n
