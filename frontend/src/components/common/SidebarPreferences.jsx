import { useTranslation } from 'react-i18next'
import useUiStore from '../../hooks/useUi'
import LocaleThemeBar from '../LocaleThemeBar'
import WorkspaceSwitcher from './WorkspaceSwitcher'

export default function SidebarPreferences({ onLogout, className = '' }) {
  const { t } = useTranslation()
  const { theme } = useUiStore()
  const isDark = theme === 'dark'

  return (
    <div className={className}>
      <WorkspaceSwitcher className="mb-3" />
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-token-textMuted px-1">{t('layout.language')}</div>
        <LocaleThemeBar className="justify-end" menuPlacement="top" />
      </div>
      <div className={['mt-2 flex items-center justify-end gap-1 border-t pt-2', isDark ? 'border-white/10' : 'border-black/[0.06]'].join(' ')}>
        <button
          type="button"
          onClick={onLogout}
          className={[
            'shrink-0 text-sm font-semibold leading-5 transition-colors px-2 py-2 rounded-lg',
            isDark
              ? 'text-red-300 hover:text-red-200 hover:bg-red-500/10'
              : 'text-red-600 hover:text-red-700 hover:bg-red-50',
          ].join(' ')}
        >
          → {t('layout.logout')}
        </button>
      </div>
    </div>
  )
}
