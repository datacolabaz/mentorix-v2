import { useTranslation } from 'react-i18next'
import useUiStore from '../hooks/useUi'

/** AZ | RU dil keçidi — auth, sidebar və landing navbar. */
export default function LanguageSwitcher({ className = '', tone = 'auto' }) {
  const { i18n, t } = useTranslation()
  const { locale, setLocale, theme } = useUiStore()
  const isDark = tone === 'dark' || (tone === 'auto' && theme === 'dark')
  const active = locale || i18n.language || 'az'

  const pick = (code) => {
    if (code === active) return
    setLocale(code)
  }

  const btn = (code, label) => {
    const on = active === code
    return (
      <button
        key={code}
        type="button"
        onClick={() => pick(code)}
        className={[
          'px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-bold transition-colors rounded-full whitespace-nowrap',
          on
            ? isDark
              ? 'bg-primary/25 text-primary border border-primary/40'
              : 'bg-primary/15 text-emerald-800 border border-primary/30'
            : isDark
              ? 'text-token-textMuted hover:text-white hover:bg-white/5 border border-transparent'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent',
        ].join(' ')}
        aria-pressed={on}
      >
        {label}
      </button>
    )
  }

  return (
    <div
      className={[
        'lang-switcher inline-flex w-fit max-w-none shrink-0 items-center gap-0.5 p-0.5 rounded-full border overflow-hidden',
        isDark ? 'border-[color:var(--border-subtle)] bg-token-surfaceCard/45' : 'border-[color:var(--border-subtle)] bg-white/70',
        className,
      ].join(' ')}
      role="group"
      aria-label={t('layout.language')}
    >
      {btn('az', 'AZ')}
      {btn('ru', 'RU')}
    </div>
  )
}
