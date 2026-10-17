import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LocaleThemeBar from '../LocaleThemeBar'
import useUiStore from '../../hooks/useUi'
import { STICKY_TOP_BAR } from '../../lib/stickyTopBar'

/**
 * Shared frame of every sign-in screen (/login, /login/:portal, /register): top bar with back link,
 * language and theme, and a centred card. `wide` is used by the portal chooser.
 */
export default function AuthShell({ children, backTo = '/', backLabel, wide = false, cardClassName = '' }) {
  const { t } = useTranslation()
  const { theme } = useUiStore()
  const isDark = theme === 'dark'
  const tone = isDark ? 'dark' : 'light'

  return (
    <div
      className={[
        'login-wrapper flex min-h-[100svh] w-full min-w-0 max-w-full flex-col',
        isDark ? 'theme-dark' : 'theme-light',
      ].join(' ')}
    >
      <header
        className={[
          STICKY_TOP_BAR,
          'shrink-0 w-full px-4 py-3 sm:pt-6 sm:pb-4',
          isDark ? 'border-white/10' : 'border-slate-200/80',
        ].join(' ')}
      >
        <div className="flex w-full items-center justify-between gap-2 sm:gap-3">
          <Link
            to={backTo}
            className={[
              'inline-flex items-center gap-1 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap min-w-0',
              isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900',
            ].join(' ')}
          >
            {backLabel || t('auth.backHome')}
          </Link>
          <LocaleThemeBar tone={tone} />
        </div>
      </header>
      <main className="flex flex-1 items-start sm:items-center justify-center px-4 pb-8 sm:pb-10 min-h-0 overflow-y-auto">
        <div id="mx-login" className={['w-full scroll-mt-6', wide ? 'max-w-2xl' : 'max-w-sm'].join(' ')}>
          <div
            className={[
              'mx-login-card rounded-2xl border p-6 sm:p-7',
              isDark ? 'border-white/20 bg-surface-2' : 'border-slate-200 bg-white shadow-sm',
              cardClassName,
            ].join(' ')}
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
