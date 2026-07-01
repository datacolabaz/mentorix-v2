import { useTranslation } from 'react-i18next'
import { readStoredLocale } from '../i18n'
import useUiStore from './useUi'

/** Aktiv UI dili — t(), localStorage və <html lang> ilə uyğun. */
export default function useActiveLocale() {
  const storeLocale = useUiStore((s) => s.locale)
  const { i18n } = useTranslation()
  const htmlLang =
    typeof document !== 'undefined' ? String(document.documentElement.lang || '').toLowerCase() : ''
  const resolved =
    i18n.resolvedLanguage ||
    i18n.language ||
    htmlLang ||
    storeLocale ||
    readStoredLocale() ||
    'az'
  return String(resolved).toLowerCase().startsWith('ru') ? 'ru' : 'az'
}
