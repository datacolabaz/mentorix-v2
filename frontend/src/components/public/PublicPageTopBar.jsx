import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Brand from '../common/Brand'
import LocaleThemeBar from '../LocaleThemeBar'
import useUiStore from '../../hooks/useUi'

/** İctimai marketinq səhifələri — geri, başlıq (mobil uyğun). */
export default function PublicPageTopBar({
  backTo = '/',
  title,
  subtitle,
  children,
  /** Mobil: yalnız geri + dil/tema; başlıq/CTA desktopda qalır. */
  compactOnMobile = false,
}) {
  const { t } = useTranslation()
  const theme = useUiStore((s) => s.theme)
  const light = theme !== 'dark'
  const showHero = Boolean(title || subtitle || children)

  return (
    <header
      className={
        light
          ? 'border-b border-slate-200 bg-white/95 backdrop-blur-sm z-[500] shrink-0 sticky top-0'
          : 'border-b border-white/10 bg-[#0f0f0f]/95 backdrop-blur-sm z-[500] shrink-0 sticky top-0'
      }
    >
      <div
        className={[
          'max-w-7xl mx-auto px-4',
          compactOnMobile
            ? showHero
              ? 'py-2 lg:py-3 lg:space-y-3'
              : 'py-2'
            : showHero
              ? 'py-3 space-y-3'
              : 'py-3',
        ].join(' ')}
      >
        <div className="flex items-center justify-between gap-2">
          <Link
            to={backTo}
            className={
              light
                ? 'inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 min-h-[40px] px-1 -ml-1 rounded-lg hover:bg-slate-100 transition-colors'
                : 'inline-flex items-center gap-1.5 text-sm font-semibold text-gray-300 hover:text-white min-h-[40px] px-1 -ml-1 rounded-lg hover:bg-white/5 transition-colors'
            }
          >
            <span aria-hidden className="text-base leading-none">
              ←
            </span>
            <span className="truncate max-w-[min(100%,14rem)] sm:max-w-none">{t('publicNav.backHome')}</span>
          </Link>
          <LocaleThemeBar tone={light ? 'light' : 'dark'} />
        </div>

        {showHero ? (
          <div
            className={[
              'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
              compactOnMobile ? 'hidden lg:flex' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {(title || subtitle) ? (
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <Link to={backTo} className="shrink-0 hidden sm:block" aria-label={t('publicNav.backHome')}>
                  <Brand className="h-7 w-auto sm:h-8" tone={light ? 'light' : 'dark'} />
                </Link>
                <div className="min-w-0 flex-1">
                  {title ? (
                    <h1
                      className={
                        light
                          ? 'font-display font-bold text-base leading-snug sm:text-lg md:text-xl text-slate-900 break-words'
                          : 'font-display font-bold text-base leading-snug sm:text-lg md:text-xl text-white break-words'
                      }
                    >
                      {title}
                    </h1>
                  ) : null}
                  {subtitle ? (
                    <p
                      className={
                        light
                          ? 'text-[11px] sm:text-xs text-slate-500 mt-1 leading-snug'
                          : 'text-[11px] sm:text-xs text-gray-500 mt-1 leading-snug'
                      }
                    >
                      {subtitle}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {children ? (
              <div className="flex flex-row flex-wrap items-center gap-2 w-full sm:w-auto sm:shrink-0 sm:justify-end">
                {children}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  )
}
