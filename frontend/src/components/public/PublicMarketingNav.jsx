import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Brand from '../common/Brand'
import LanguageSwitcher from '../LanguageSwitcher'

const NAV_LINK =
  'mx-landing-nav-link text-gray-300 hover:text-white px-2 py-1.5 rounded-lg text-xs lg:text-sm font-semibold whitespace-nowrap'

const NAV_LINK_ACTIVE = 'text-white bg-white/5'

const LOGIN_BTN =
  'shrink-0 whitespace-nowrap rounded-lg bg-primary/15 border border-primary/35 text-primary px-3 py-2 min-h-11 md:min-h-[36px] md:px-3 md:py-1.5 text-sm font-semibold hover:bg-primary/25'

const CTA_BTN =
  'shrink-0 whitespace-nowrap rounded-lg bg-primary px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-bold text-[#041018] hover:brightness-95'

const LINKS = [
  { to: '/muellimler-ucun', labelKey: 'landing.nav.forTeachers' },
  { to: '/imtahanlar', labelKey: 'landing.nav.examsTests' },
]

function linkClass(pathname, to) {
  return `${NAV_LINK}${pathname === to ? ` ${NAV_LINK_ACTIVE}` : ''}`
}

/**
 * İctimai naviqasiya: loqo, Müəllimlər üçün, İmtahanlar / Testlər, dil, CTA.
 * Mobil: yuxarı sağda yalnız «Daxil ol»; dil və linklər thumb-zone menyudadır.
 */
export default function PublicMarketingNav({ onLogin, onStart }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const onHome = location.pathname === '/'

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => {
      if (mq.matches) setMobileNavOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!mobileNavOpen) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [mobileNavOpen])

  const closeMobileNav = () => setMobileNavOpen(false)

  const goLogin = () => {
    closeMobileNav()
    if (onLogin) onLogin()
    else navigate('/login')
  }

  const goStart = () => {
    closeMobileNav()
    if (onStart) onStart()
    else navigate('/login')
  }

  const goHome = () => {
    closeMobileNav()
    if (onHome) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    navigate('/')
  }

  return (
    <>
      <nav
        className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0b0b]/92 backdrop-blur-md supports-[backdrop-filter]:bg-[#0b0b0b]/80"
        aria-label={t('landing.nav.mainNav')}
      >
        <div className="max-w-5xl mx-auto pl-2 sm:pl-3 pr-3 sm:pr-4 py-3 flex items-center justify-between gap-2 min-w-0">
          <button
            type="button"
            onClick={goHome}
            className="shrink-0 min-w-0 rounded-lg transition-opacity duration-200 hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="Mentorix"
          >
            <Brand size="nav" />
          </button>

          <div className="flex items-center gap-1.5 md:gap-2 shrink-0 min-w-0">
            <div className="hidden md:flex items-center gap-0.5 lg:gap-1">
              {LINKS.map((item) => (
                <Link key={item.to} to={item.to} className={linkClass(location.pathname, item.to)}>
                  {t(item.labelKey)}
                </Link>
              ))}
            </div>
            <div className="hidden md:block">
              <LanguageSwitcher tone="dark" className="h-auto" />
            </div>
            <button type="button" onClick={goLogin} className={LOGIN_BTN}>
              {t('landing.nav.login')}
            </button>
            <button type="button" onClick={goStart} className={`hidden md:inline-flex ${CTA_BTN}`}>
              {t('landing.nav.startFree')}
            </button>
          </div>
        </div>
      </nav>

      {mobileNavOpen ? (
        <button
          type="button"
          className="md:hidden fixed inset-0 z-[55] bg-black/55"
          aria-label={t('landing.nav.closeMenu')}
          onClick={closeMobileNav}
        />
      ) : null}

      {mobileNavOpen ? (
        <div
          id="mx-landing-mobile-nav"
          className="md:hidden fixed inset-x-0 bottom-0 z-[56] border-t border-white/10 bg-[#111]/98 backdrop-blur-md rounded-t-2xl px-4 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] shadow-[0_-12px_40px_rgba(0,0,0,0.45)]"
          role="dialog"
          aria-modal="true"
          aria-label={t('landing.nav.mainNav')}
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" aria-hidden />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
            {t('landing.nav.language')}
          </p>
          <LanguageSwitcher tone="dark" size="comfortable" className="mb-3" />
          <div className="space-y-0.5">
            {LINKS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={closeMobileNav}
                className={`flex items-center min-h-[44px] ${linkClass(location.pathname, item.to)}`}
              >
                {t(item.labelKey)}
              </Link>
            ))}
          </div>
          <button
            type="button"
            onClick={goStart}
            className="mt-3 w-full inline-flex justify-center items-center rounded-xl bg-primary px-4 py-3 min-h-[44px] text-sm font-bold text-[#041018]"
          >
            {t('landing.nav.startFree')}
          </button>
        </div>
      ) : null}

      <button
        type="button"
        className={[
          'md:hidden fixed z-[57] inline-flex h-12 w-12 items-center justify-center rounded-full',
          'right-4 bottom-[max(1rem,env(safe-area-inset-bottom,0px))]',
          'border border-white/15 bg-[#161616]/95 text-gray-100 shadow-[0_8px_28px_rgba(0,0,0,0.45)]',
          'hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        ].join(' ')}
        aria-expanded={mobileNavOpen}
        aria-controls="mx-landing-mobile-nav"
        aria-label={mobileNavOpen ? t('landing.nav.closeMenu') : t('landing.nav.openMenu')}
        onClick={() => setMobileNavOpen((open) => !open)}
      >
        {mobileNavOpen ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        )}
      </button>
    </>
  )
}
