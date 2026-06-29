import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Brand from '../common/Brand'
import LanguageSwitcher from '../LanguageSwitcher'

/** İctimai marketinq səhifələri — geri, dil, başlıq (mobil uyğun). */
export default function PublicPageTopBar({ backTo = '/', title, subtitle, children }) {
  const { t } = useTranslation()

  return (
    <header className="border-b border-white/10 bg-[#0f0f0f]/95 backdrop-blur-sm z-[500] shrink-0 sticky top-0">
      <div className="max-w-7xl mx-auto px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Link
            to={backTo}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-300 hover:text-white min-h-[40px] px-1 -ml-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <span aria-hidden className="text-base leading-none">
              ←
            </span>
            <span className="truncate max-w-[min(100%,14rem)] sm:max-w-none">{t('publicNav.backHome')}</span>
          </Link>
          <LanguageSwitcher tone="dark" className="w-[5.5rem] shrink-0" />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Link to={backTo} className="shrink-0 hidden sm:block" aria-label={t('publicNav.backHome')}>
              <Brand className="h-7 w-auto sm:h-8" />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="font-display font-bold text-base leading-snug sm:text-lg md:text-xl text-white break-words">
                {title}
              </h1>
              {subtitle ? (
                <p className="text-[11px] sm:text-xs text-gray-500 mt-1 leading-snug">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {children ? (
            <div className="flex flex-row flex-wrap items-center gap-2 w-full sm:w-auto sm:shrink-0 sm:justify-end">
              {children}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
