import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/** Public fallback for retired internal-video links (/live/join/:token guest links, /lr/:token recording shares). */
export default function LiveRetiredNotice() {
  const { t } = useTranslation()
  return (
    <main className="flex min-h-[70vh] items-center justify-center p-4">
      <div className="max-w-xl rounded-2xl border border-[color:var(--border-subtle)] bg-token-surfaceMain p-6 text-center sm:p-8">
        <h1 className="font-display text-lg font-bold text-token-textMain">{t('liveLessons.retired.title')}</h1>
        <p className="mt-2 text-sm text-token-textMuted">{t('liveLessons.retired.publicText')}</p>
        <Link to="/" className="mt-5 inline-flex rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-on hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
          {t('liveLessons.retired.home')}
        </Link>
      </div>
    </main>
  )
}
