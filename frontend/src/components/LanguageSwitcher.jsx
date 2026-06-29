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
          'flex-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-colors',
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
        'w-full flex items-center gap-1 p-1 rounded-xl border',
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
