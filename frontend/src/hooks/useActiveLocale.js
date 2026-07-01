import { useTranslation } from 'react-i18next'
import useUiStore from './useUi'

/** UI dil seçimi — zustand store + i18n (universitet kataloqu üçün). */
export default function useActiveLocale() {
  const storeLocale = useUiStore((s) => s.locale)
  const { i18n } = useTranslation()
  const resolved = storeLocale || i18n.resolvedLanguage || i18n.language || 'az'
  return String(resolved).toLowerCase().startsWith('ru') ? 'ru' : 'az'
}
