import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/** Fallback for URLs of features that no longer exist (see lib/retiredRoutes.js). */
export default function RetiredPage() {
  const { t } = useTranslation()

  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  const linkClass =
    'inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus'

  return (
    <main className="flex min-h-[70vh] items-center justify-center p-4">
      <div className="max-w-xl rounded-2xl border border-[color:var(--border-subtle)] bg-token-surfaceMain p-6 text-center sm:p-8">
        <h1 className="font-display text-lg font-bold text-token-textMain">{t('retiredPage.title')}</h1>
        <p className="mt-2 text-sm text-token-textMuted">{t('retiredPage.text')}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link to="/" className={`${linkClass} bg-brand text-brand-on hover:bg-brand-hover`}>
            {t('retiredPage.home')}
          </Link>
          <Link to="/app" className={`${linkClass} border border-[color:var(--border-subtle)] text-token-textMain`}>
            {t('retiredPage.dashboard')}
          </Link>
        </div>
      </div>
    </main>
  )
}
