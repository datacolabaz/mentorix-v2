import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Brand from '../common/Brand'
import LocaleThemeBar from '../LocaleThemeBar'
import LanguageSwitcher from '../LanguageSwitcher'
import ThemeToggleIcon from '../ThemeToggleIcon'
import { COMPACT_PUBLIC_NAV_MQ, isCompactPublicNav } from '../../lib/compactPublicNav'
import useUiStore from '../../hooks/useUi'
import useAuthStore from '../../hooks/useAuth'
import { dashboardPathForUser } from '../../lib/postAuth'
import { filterNavItemsByFlags, useFeatureFlags } from '../../lib/featureFlags'
import { BRAND } from '../../lib/brand'

const LINKS = [
  { to: '/#mx-steps', labelKey: 'home.nav.howItWorks', hash: 'mx-steps' },
  { to: '/muellimler-ucun', labelKey: 'landing.nav.forTeachers' },
  { to: '/imtahanlar', labelKey: 'landing.nav.exams' },
  { to: '/mentorship', labelKey: 'landing.nav.mentorship' },
  { to: '/qiymetler', labelKey: 'landing.nav.plans' },
]

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'

const DESKTOP_LINK = `inline-flex items-center min-h-10 px-2.5 rounded-lg text-body-sm font-semibold whitespace-nowrap transition-colors ${FOCUS}`

const CTA_BTN = `shrink-0 inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-brand text-brand-on hover:bg-brand-hover min-h-11 px-4 text-button shadow-card transition-colors ${FOCUS}`

const SECONDARY_BTN = `shrink-0 inline-flex items-center justify-center whitespace-nowrap rounded-xl border border-line text-fg hover:bg-canvas-subtle min-h-11 px-3.5 text-button transition-colors ${FOCUS}`

function useCompactPublicNav() {
  const [compact, setCompact] = useState(() => isCompactPublicNav())
  useEffect(() => {
    const mq = window.matchMedia(COMPACT_PUBLIC_NAV_MQ)
    const onChange = () => setCompact(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return compact
}

function isActive(location, item) {
  if (item.hash) return location.pathname === '/' && location.hash === `#${item.hash}`
  return location.pathname === item.to
}

/**
 * Public header: logo, primary links, language/theme, secondary «Daxil ol» and one dominant «Pulsuz başla».
 * Compact (<lg): logo + «Pulsuz başla» + menu button; links, language, theme and login live in the sheet.
 */
export default function PublicMarketingNav({ onLogin, onStart }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { flags: featureFlags } = useFeatureFlags()
  const links = filterNavItemsByFlags(LINKS, featureFlags)
  const compact = useCompactPublicNav()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const onHome = location.pathname === '/'
  const user = useAuthStore((s) => s.user)
  const { theme } = useUiStore()
  const tone = theme === 'dark' ? 'dark' : 'light'

  useEffect(() => {
    if (!compact) setMobileNavOpen(false)
  }, [compact])

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
    if (user) navigate(dashboardPathForUser(user))
    else if (onLogin) onLogin()
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

  const onLinkClick = (item) => (e) => {
    closeMobileNav()
    if (item.hash && onHome) {
      const el = document.getElementById(item.hash)
      if (el) {
        e.preventDefault()
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        window.history.replaceState(null, '', `/#${item.hash}`)
      }
    }
  }

  const loginLabel = user
    ? user.role === 'admin'
      ? t('landing.nav.adminPanel', { defaultValue: 'Admin panel' })
      : t('landing.nav.myPanel', { defaultValue: 'Panelim' })
    : t('landing.nav.login')

  const menuLayer =
    compact && mobileNavOpen && typeof document !== 'undefined'
      ? createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[2000] bg-slate-950/60"
              aria-label={t('landing.nav.closeMenu')}
              onClick={closeMobileNav}
            />
            <div
              id="mx-landing-mobile-nav"
              className="fixed inset-x-0 bottom-0 z-[2010] max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-surface-elevated px-4 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] text-fg shadow-elevated"
              role="dialog"
              aria-modal="true"
              aria-label={t('landing.nav.mainNav')}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" aria-hidden />
              <nav aria-label={t('landing.nav.mainNav')} className="space-y-1">
                {links.map((item) => {
                  const active = isActive(location, item)
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={onLinkClick(item)}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center min-h-12 rounded-lg px-3 text-body font-semibold ${FOCUS} ${
                        active ? 'bg-canvas-subtle text-fg' : 'text-fg hover:bg-canvas-subtle'
                      }`}
                    >
                      {t(item.labelKey)}
                    </Link>
                  )
                })}
              </nav>
              <p className="mt-4 mb-2 text-caption font-semibold uppercase tracking-wider text-fg-muted">
                {t('home.nav.preferences')}
              </p>
              <div className="flex items-center gap-2">
                <LanguageSwitcher tone={tone} size="comfortable" className="flex-1" />
                <ThemeToggleIcon tone={tone} className="!h-12 !w-12" />
              </div>
              <div className="mt-4 grid gap-2">
                <button type="button" onClick={goStart} className={`${CTA_BTN} w-full min-h-[52px] text-body`}>
                  {t('landing.nav.startFree')}
                </button>
                <button type="button" onClick={goLogin} className={`${SECONDARY_BTN} w-full min-h-12`}>
                  {loginLabel}
                </button>
              </div>
            </div>
          </>,
          document.body,
        )
      : null

  return (
    <>
      <header className="sticky top-0 z-[2020] border-b border-line bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl min-w-0 items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
          <button
            type="button"
            onClick={goHome}
            className={`shrink-0 min-w-0 rounded-lg py-1 ${FOCUS}`}
            aria-label={t('home.nav.homeLabel', { brand: BRAND.name })}
          >
            <Brand size="nav" tone={tone} />
          </button>

          <nav aria-label={t('landing.nav.mainNav')} className="hidden lg:flex items-center gap-0.5">
            {links.map((item) => {
              const active = isActive(location, item)
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onLinkClick(item)}
                  aria-current={active ? 'page' : undefined}
                  className={`${DESKTOP_LINK} ${
                    active ? 'bg-canvas-subtle text-fg' : 'text-fg-secondary hover:text-fg hover:bg-canvas-subtle'
                  }`}
                >
                  {t(item.labelKey)}
                </Link>
              )
            })}
          </nav>

          <div className="flex min-w-0 shrink-0 items-center gap-2">
            {!compact ? (
              <>
                <LocaleThemeBar tone={tone} />
                <button type="button" onClick={goLogin} className={SECONDARY_BTN}>
                  {loginLabel}
                </button>
              </>
            ) : null}
            <button type="button" onClick={goStart} className={`${CTA_BTN} max-[359px]:px-3`}>
              {t('landing.nav.startFree')}
            </button>
            {compact ? (
              <button
                type="button"
                data-landing-menu-fab=""
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-fg hover:bg-canvas-subtle ${FOCUS}`}
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
            ) : null}
          </div>
        </div>
      </header>
      {menuLayer}
    </>
  )
}
