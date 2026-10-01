import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import az from '../locales/az/translation.json'
import { universityCatalogAz, universityCatalogEn, universityCatalogRu } from '../locales/universityCatalog'
import { publicLandingsAz, publicLandingsEn, publicLandingsRu } from '../locales/publicLandings'
import { homeAz, homeEn, homeRu } from '../locales/home'
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

const azResources = { ...withUniversityCatalog(az, universityCatalogAz), ...publicLandingsAz, home: homeAz }

/**
 * Azerbaijani (default) ships in the main bundle; ru/en (~520 KB of JSON) are split into their own
 * chunks and fetched only when that language is active. tr/de reuse the English bundle.
 */
const LAZY_BUNDLES = {
  ru: () =>
    import('../locales/ru/translation.json').then((m) => ({
      ...withUniversityCatalog(m.default, universityCatalogRu),
      ...publicLandingsRu,
      home: homeRu,
    })),
  en: () =>
    import('../locales/en/translation.json').then((m) => ({
      ...withUniversityCatalog(m.default, universityCatalogEn),
      ...publicLandingsEn,
      home: homeEn,
    })),
}
const BUNDLE_SOURCE = { tr: 'en', de: 'en' }

const lazyLocaleBackend = {
  type: 'backend',
  init() {},
  read(language, namespace, callback) {
    const load = LAZY_BUNDLES[BUNDLE_SOURCE[language] || language]
    if (namespace !== 'translation' || !load) {
      callback(null, {})
      return
    }
    load().then(
      (resources) => callback(null, resources),
      (err) => callback(err, null),
    )
  },
}

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

/** Resolves once the initial language bundle is available (immediately for az). */
export const i18nReady = i18n
  .use(detector)
  .use(lazyLocaleBackend)
  .use(initReactI18next)
  .init({
    resources: {
      az: { translation: azResources },
    },
    partialBundledLanguages: true,
    initAsync: false,
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
  })
  .catch(() => {})

export default i18n
