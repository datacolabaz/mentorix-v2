import { useTranslation } from 'react-i18next'
import useUiStore from '../hooks/useUi'

function SunIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 3v1.5M12 19.5V21M4.2 4.2l1.1 1.1M18.7 18.7l1.1 1.1M3 12h1.5M19.5 12H21M4.2 19.8l1.1-1.1M18.7 5.3l1.1-1.1" />
    </svg>
  )
}

function MoonIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 14.3A8.5 8.5 0 1110.1 3.4 7 7 0 0021 14.3z"
      />
    </svg>
  )
}

/** Gecə / gündüz — dil seçiminin yanında dairəvi ikon. */
export default function ThemeToggleIcon({ className = '', tone = 'auto' }) {
  const { t } = useTranslation()
  const { theme, toggleTheme } = useUiStore()
  const isDark = tone === 'dark' || (tone === 'auto' && theme === 'dark')
  const dark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={[
        'inline-flex h-9 w-9 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full border transition-colors',
        isDark
          ? 'border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
        className,
      ].join(' ')}
      aria-label={dark ? t('layout.themeLight') : t('layout.themeDark')}
      title={dark ? t('layout.themeLight') : t('layout.themeDark')}
    >
      {dark ? <MoonIcon /> : <SunIcon />}
    </button>
  )
}
