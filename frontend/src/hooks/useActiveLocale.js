import { useTranslation } from 'react-i18next'
import useUiStore from './useUi'

/** Aktiv UI dili — i18n ilə eyni mənbə (t() ilə uyğun). */
export default function useActiveLocale() {
  const storeLocale = useUiStore((s) => s.locale)
  const { i18n } = useTranslation()
  const resolved = i18n.resolvedLanguage || i18n.language || storeLocale || 'az'
  return String(resolved).toLowerCase().startsWith('ru') ? 'ru' : 'az'
}
