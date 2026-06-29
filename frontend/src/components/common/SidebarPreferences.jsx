import { useTranslation } from 'react-i18next'
import useUiStore from '../../hooks/useUi'
import LanguageSwitcher from '../LanguageSwitcher'

export default function SidebarPreferences({ onLogout, className = '' }) {
  const { t } = useTranslation()
  const { theme, toggleTheme } = useUiStore()
  const isDark = theme === 'dark'

  return (
    <div className={className}>
      <div className="mb-3">
        <div className="text-xs font-semibold text-token-textMuted mb-2 px-1">{t('layout.language')}</div>
        <LanguageSwitcher />
      </div>
      <button
        type="button"
        onClick={toggleTheme}
        className={[
          'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors',
          isDark
            ? 'border-[color:var(--border-subtle)] bg-token-surfaceCard/45 hover:bg-token-surfaceCard/60'
            : 'border-[color:var(--border-subtle)] bg-token-surfaceCard/70 hover:bg-token-surfaceCard/90',
        ].join(' ')}
      >
        <span className="text-sm font-medium text-token-textMain">{t('layout.theme')}</span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-token-textMuted">
            {theme === 'dark' ? t('layout.themeDark') : t('layout.themeLight')}
          </span>
          <span
            aria-hidden
            className={[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              theme === 'dark' ? 'bg-primary/40' : 'bg-gray-300',
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-5 w-5 transform rounded-full bg-white transition-transform',
                theme === 'dark' ? 'translate-x-5' : 'translate-x-1',
              ].join(' ')}
            />
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onLogout}
        className={[
          'mt-3 flex items-center gap-2 text-sm font-medium transition-colors w-full px-4 py-3 rounded-xl',
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
