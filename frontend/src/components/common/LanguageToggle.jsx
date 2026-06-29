import { useTranslation } from 'react-i18next'
import useUiStore from '../../hooks/useUi'

export default function LanguageToggle({ className = '' }) {
  const { t } = useTranslation()
  const { locale, setLocale, theme } = useUiStore()
  const isDark = theme === 'dark'

  const btn = (code, label) => {
    const active = locale === code
    return (
      <button
        key={code}
        type="button"
        onClick={() => setLocale(code)}
        className={[
          'flex-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-colors',
          active
            ? isDark
              ? 'bg-primary/25 text-primary'
              : 'bg-primary/15 text-emerald-800'
            : isDark
              ? 'text-token-textMuted hover:text-white hover:bg-white/5'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
        ].join(' ')}
        aria-pressed={active}
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
