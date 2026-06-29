import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import az from '../locales/az.json'
import ru from '../locales/ru.json'

const LOCALE_KEY = 'mentorix_locale_v1'

export function readStoredLocale() {
  try {
    const v = String(localStorage.getItem(LOCALE_KEY) || '').trim().toLowerCase()
    return v === 'ru' ? 'ru' : 'az'
  } catch {
    return 'az'
  }
}

export function writeStoredLocale(locale) {
  try {
    localStorage.setItem(LOCALE_KEY, locale === 'ru' ? 'ru' : 'az')
  } catch {
    /* ignore */
  }
}

export function applyDocumentLocale(locale) {
  if (typeof document === 'undefined') return
  const lang = locale === 'ru' ? 'ru' : 'az'
  document.documentElement.lang = lang
}

const initialLocale = readStoredLocale()
applyDocumentLocale(initialLocale)

i18n.use(initReactI18next).init({
  resources: {
    az: { translation: az },
    ru: { translation: ru },
  },
  lng: initialLocale,
  fallbackLng: 'az',
  interpolation: { escapeValue: false },
  returnEmptyString: false,
})

export default i18n
