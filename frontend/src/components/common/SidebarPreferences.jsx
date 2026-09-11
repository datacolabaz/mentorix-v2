import { useTranslation } from 'react-i18next'
import useUiStore from '../../hooks/useUi'
import LocaleThemeBar from '../LocaleThemeBar'

export default function SidebarPreferences({ onLogout, className = '' }) {
  const { t } = useTranslation()
  const { theme } = useUiStore()
  const isDark = theme === 'dark'

  return (
    <div className={className}>
      <div className="mb-3">
        <div className="text-xs font-semibold text-token-textMuted mb-2 px-1">{t('layout.language')}</div>
        <LocaleThemeBar className="w-full justify-between" menuPlacement="top" />
      </div>
      <button
        type="button"
        onClick={onLogout}
        className={[
          'mt-1 flex items-center gap-2 text-sm font-medium transition-colors w-full px-4 py-3 rounded-xl',
          isDark
            ? 'text-red-300 hover:text-red-200 hover:bg-red-500/10'
            : 'text-red-600 hover:text-red-700 hover:bg-red-50',
        ].join(' ')}
      >
        → {t('layout.logout')}
      </button>
    </div>
  )
}
