import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Brand from '../../components/common/Brand'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import api from '../../lib/api'
import { trackEvent, trackRegisterClick, trackPricingView } from '../../lib/analytics'
import { defaultLoginMarketingPayload } from '../../constants/defaultLoginMarketing'
import { setPageSeo } from '../../lib/pageSeo'
import PublicSeoFooter from '../../components/public/PublicSeoFooter'
import { resolveUiLocale } from '../../lib/uiLocale'
import LandingDemoActivityChart from '../../components/landing/LandingDemoActivityChart'
import LandingHeroProductPreview from '../../components/landing/LandingHeroProductPreview'
import CertifiedExamsSection from '../../components/landing/CertifiedExamsSection'
import PricingFeatureListItem from '../../components/landing/PricingFeatureListItem'
import {
  LandingFeatureTabs,
  LandingHoverCard,
  LandingWhyAccordion,
} from '../../components/landing/LandingInteractiveCards'
import { DEFAULT_SUBSCRIPTION_PLANS } from '../../constants/subscriptionPlans'
import { normalizePlanId } from '../../lib/subscriptionPlanMarketing'
import { isMarketingSectionVisible } from '../../lib/loginMarketingVisibility'
import {
  useLandingHero,
  useLandingWhy,
  useLandingSteps,
  useLandingFeatures,
  useLandingFaq,
  useLandingCtaBand,
  useLandingPlanDisplay,
} from '../../lib/landingCopy'

function scrollToId(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const LANDING_NAV_LINK =
  'mx-landing-nav-link text-gray-300 hover:text-white px-2 py-1.5 rounded-lg'

const LANDING_LOGIN_BTN =
  'shrink-0 whitespace-nowrap rounded-lg bg-primary/15 border border-primary/35 text-primary px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold hover:bg-primary/25'

const LANDING_NAV_CTA =
  'shrink-0 whitespace-nowrap rounded-lg bg-primary px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-bold text-[#041018] hover:brightness-95'

function LandingPlanCard({ plan, onCta }) {
  const { t, i18n } = useTranslation()
  const display = useLandingPlanDisplay(plan, t, i18n)
  const isBasicTrial = normalizePlanId(plan) === 'basic'
  return (
    <div className="rounded-2xl border border-white/10 bg-[#121212]/90 p-4 space-y-3 flex flex-col motion-safe:transition motion-safe:duration-300 motion-safe:hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_16px_40px_-20px_rgba(0,229,176,0.45)]">
      <div>
        <div className="text-sm font-bold text-white">{display.title}</div>
        {display.meta.subtitle ? (
          <p className="text-[11px] text-gray-400 mt-0.5">{display.meta.subtitle}</p>
        ) : null}
      </div>
      <div className="text-lg font-semibold text-primary tabular-nums">{display.priceLabel}</div>
      <ul className="pricing-feature text-[11px] text-gray-400 space-y-1 flex-1">
        {display.bullets.slice(0, isBasicTrial ? 3 : 5).map((line) => (
          <PricingFeatureListItem
            key={`${plan.id}-${line}`}
            line={line}
            isBasicTrial={isBasicTrial}
          />
        ))}
      </ul>
      <button
        type="button"
        onClick={onCta}
        className="w-full rounded-xl px-4 py-2.5 text-xs font-bold bg-primary text-[#041018] hover:brightness-95"
      >
        {display.meta.cta}
      </button>
    </div>
  )
}

function arrayFromT(t, key) {
  const v = t(key, { returnObjects: true })
  return Array.isArray(v) ? v : []
}

/** Ana səhifə — marketinq landing (/). */
export default function Landing() {
  const { t, i18n } = useTranslation()
  const landingSectionSeenRef = useRef(new Set())
  const [publicPlans, setPublicPlans] = useState(DEFAULT_SUBSCRIPTION_PLANS)
  const [demoOpen, setDemoOpen] = useState(false)
  const [demoTab, setDemoTab] = useState('overview')
  const [demoPaneBusy, setDemoPaneBusy] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [marketing, setMarketing] = useState(() => defaultLoginMarketingPayload())
  const navigate = useNavigate()

  useEffect(() => {
    setPageSeo({
      title: t('landing.seo.title'),
      description: t('landing.seo.description'),
      canonicalPath: '/',
      keywords: t('landing.seo.keywords'),
      locale: resolveUiLocale(i18n.language),
      breadcrumbs: [{ name: 'Mentorix', path: '/' }],
    })
  }, [t, i18n.language])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    const onChange = () => {
      if (mq.matches) setMobileNavOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const closeMobileNav = () => setMobileNavOpen(false)

  const why = useLandingWhy(marketing, t, i18n)
  const steps = useLandingSteps(marketing, t, i18n)
  const features = useLandingFeatures(marketing, t, i18n)
  const faq = useLandingFaq(marketing, t, i18n)
  const ctaBand = useLandingCtaBand(marketing, t, i18n)

  const showMarketplace = isMarketingSectionVisible(marketing.marketplace)
  const showUniversities = isMarketingSectionVisible(marketing.universities)
  const showPricing = isMarketingSectionVisible(marketing.pricing)

  const goRegister = (surface) => {
    trackEvent('mx_landing_cta_primary', { surface, event_type: 'register_click' })
    trackRegisterClick()
    setDemoOpen(false)
    navigate('/login')
  }

  const goLogin = (surface) => {
    if (surface) trackEvent('mx_landing_secondary_click', { action: 'login_nav', surface })
    setDemoOpen(false)
    navigate('/login')
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const d = await api.get('/public/subscription-plans')
        const plans = (Array.isArray(d?.plans) ? d.plans : []).filter(Boolean)
        if (!cancelled && plans.length) setPublicPlans(plans)
      } catch {
        /* default plans */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.get('/public/marketing/login', { params: { _: Date.now() } })
        if (!cancelled && data?.success && data?.landing) setMarketing(data.landing)
      } catch {
        /* defolt marketing state qalır */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!demoOpen) return
    setDemoPaneBusy(true)
    const id = window.setTimeout(() => setDemoPaneBusy(false), 400)
    return () => window.clearTimeout(id)
  }, [demoOpen, demoTab])

  useEffect(() => {
    trackEvent('mx_public_landing_view', { path: typeof window !== 'undefined' ? window.location.pathname || '/' : '/' })
  }, [])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const seen = landingSectionSeenRef.current
    const targets = []

    const obs = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue
          const id = en.target instanceof HTMLElement ? en.target.id : ''
          if (!id || seen.has(id)) continue
          seen.add(id)
          trackEvent('mx_landing_section_view', { section_id: id })
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' },
    )

    const ids = ['mx-hero-preview']
    if (isMarketingSectionVisible(marketing?.why) && why.cards.length > 0) ids.push('mx-why')
    if (isMarketingSectionVisible(marketing.steps) && steps.items.length > 0) ids.push('mx-steps')
    if (isMarketingSectionVisible(marketing.features) && features.items.length > 0) ids.push('mx-features')
    if (isMarketingSectionVisible(marketing.faq) && faq.items.length > 0) ids.push('mx-faq')
    if (isMarketingSectionVisible(ctaBand)) ids.push('mx-cta')
    for (const id of ids) {
      const el = typeof document !== 'undefined' ? document.getElementById(id) : null
      if (el) {
        obs.observe(el)
        targets.push(el)
      }
    }

    return () => {
      for (const el of targets) {
        try {
          obs.unobserve(el)
        } catch {
          /* ignore */
        }
      }
      obs.disconnect()
    }
  }, [
    marketing?.why,
    marketing.steps,
    marketing.features,
    marketing.faq,
    ctaBand,
    why.cards.length,
    steps.items.length,
    features.items.length,
    faq.items.length,
  ])

  const openDemoTracked = (surface) => {
    trackEvent('mx_landing_demo_open', { surface })
    trackPricingView()
    setDemoTab('overview')
    setDemoOpen(true)
  }

  const onDemoTabTracked = (tabId) => {
    trackEvent('mx_landing_demo_tab', { tab: tabId })
    setDemoTab(tabId)
  }

  const closeDemoTracked = () => {
    trackEvent('mx_landing_demo_close')
    setDemoOpen(false)
  }

  const hero = useLandingHero(marketing, t, i18n)
  const marketplaceCtaLabel = hero.marketplace_cta_label
  const demoSchedule = arrayFromT(t, 'landing.demo.schedule')
  const demoPayments = arrayFromT(t, 'landing.demo.payments')
  const demoAttendance = arrayFromT(t, 'landing.demo.attendance')

  return (
    <div className="min-h-[100svh] w-full min-w-0 max-w-full overflow-x-hidden bg-[#0b0b0b]">
      <nav
        className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0b0b]/92 backdrop-blur-md supports-[backdrop-filter]:bg-[#0b0b0b]/80"
        aria-label={t('landing.nav.mainNav')}
      >
        <div className="max-w-5xl mx-auto pl-2 sm:pl-3 pr-3 sm:pr-4 py-3 flex items-center justify-between gap-2 min-w-0">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="shrink-0 min-w-0 rounded-lg transition-opacity duration-200 hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <Brand size="nav" />
          </button>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
            <div className="hidden md:flex items-center gap-1 lg:gap-2 text-xs lg:text-sm font-semibold">
              <Link to="/search" className={LANDING_NAV_LINK}>
                {t('landing.nav.findTeacher')}
              </Link>
              <Link to="/universities" className={LANDING_NAV_LINK}>
                {t('landing.nav.universities')}
              </Link>
              <button
                type="button"
                onClick={() => scrollToId(features.items.length ? 'mx-features' : 'mx-steps')}
                className={LANDING_NAV_LINK}
              >
                {t('landing.nav.features')}
              </button>
              <Link to="/qiymetler" className={LANDING_NAV_LINK}>
                {t('landing.nav.plans')}
              </Link>
            </div>
            <LanguageSwitcher tone="dark" className="h-8 sm:h-auto" />
            <button
              type="button"
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 hover:text-white"
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
            <button type="button" onClick={() => goLogin('nav')} className={LANDING_LOGIN_BTN}>
              {t('landing.nav.login')}
            </button>
            <button type="button" onClick={() => goRegister('nav')} className={`hidden sm:inline-flex ${LANDING_NAV_CTA}`}>
              {t('landing.nav.startFree')}
            </button>
          </div>
        </div>
        {mobileNavOpen ? (
          <div
            id="mx-landing-mobile-nav"
            className="md:hidden border-t border-white/10 bg-[#0b0b0b]/98 px-3 py-2 space-y-0.5"
          >
            <Link to="/search" onClick={closeMobileNav} className={`block w-full ${LANDING_NAV_LINK}`}>
              {t('landing.nav.findTeacher')}
            </Link>
            <Link to="/universities" onClick={closeMobileNav} className={`block w-full ${LANDING_NAV_LINK}`}>
              {t('landing.nav.universities')}
            </Link>
            <button
              type="button"
              onClick={() => {
                closeMobileNav()
                scrollToId(features.items.length ? 'mx-features' : 'mx-steps')
              }}
              className={`block w-full text-left ${LANDING_NAV_LINK}`}
            >
              {t('landing.nav.features')}
            </button>
            <Link to="/qiymetler" onClick={closeMobileNav} className={`block w-full ${LANDING_NAV_LINK}`}>
              {t('landing.nav.plans')}
            </Link>
            <button
              type="button"
              onClick={() => {
                closeMobileNav()
                goRegister('nav_mobile')
              }}
              className="mt-2 w-full inline-flex justify-center items-center rounded-xl bg-primary px-4 py-3 min-h-[44px] text-sm font-bold text-[#041018]"
            >
              {t('landing.nav.startFree')}
            </button>
          </div>
        ) : null}
      </nav>

      <div className="w-full max-w-5xl mx-auto px-4 pt-8 sm:pt-10 pb-8 space-y-12 sm:space-y-16 min-w-0 box-border overflow-x-hidden">
        <header className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] gap-8 lg:gap-10 lg:items-center">
          <div className="w-full min-w-0 space-y-4 flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-gray-300">
              <span className="mx-nav-live-dot h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_12px_rgba(0,229,176,0.9)]" />
              {hero.pill}
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-tight w-full max-w-xl">
              {hero.headline}
            </h1>
            <p className="text-gray-400 text-sm sm:text-base leading-relaxed w-full max-w-md lg:max-w-xl">
              {hero.subheadline}
            </p>
            <div className="flex flex-col w-full max-w-md lg:max-w-xl gap-3">
              <button
                type="button"
                onClick={() => goRegister('hero')}
                className="w-full inline-flex justify-center items-center text-center rounded-xl bg-primary px-4 sm:px-5 py-3.5 min-h-[52px] text-sm sm:text-base font-bold text-[#041018] shadow-lg shadow-primary/25 hover:brightness-95 leading-snug"
              >
                {hero.primary_cta_label}
              </button>
              <button
                type="button"
                onClick={() => {
                  trackEvent('mx_landing_secondary_click', { action: 'how_it_works' })
                  scrollToId('mx-steps')
                }}
                className="w-full inline-flex justify-center items-center rounded-xl border border-white/15 bg-transparent px-4 py-3 min-h-[44px] text-sm font-semibold text-gray-300 hover:bg-white/5 hover:text-white"
              >
                {hero.secondary_how}
              </button>
            </div>
            <div className="pt-1 w-full">
              <button
                type="button"
                onClick={() => {
                  trackEvent('mx_landing_secondary_click', { action: 'existing_account_login' })
                  goLogin('hero_existing_account')
                }}
                className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-4"
              >
                {hero.existing_account}
              </button>
            </div>
          </div>

          <LandingHeroProductPreview onOpenDemo={() => openDemoTracked('hero_product_preview')} />
        </header>

        {isMarketingSectionVisible(marketing?.why) && why.cards.length > 0 ? (
          <LandingWhyAccordion heading={why.heading} cards={why.cards} />
        ) : null}

        {isMarketingSectionVisible(marketing.features) && features.items.length > 0 ? (
          <LandingFeatureTabs heading={features.heading} items={features.items} />
        ) : null}

        {isMarketingSectionVisible(marketing.steps) && steps.items.length > 0 ? (
          <section id="mx-steps" className="space-y-4 scroll-mt-24">
            <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{steps.heading}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {steps.items.map((x, i) => (
                <LandingHoverCard
                  key={`step-${i}-${String(x.step)}`}
                  className="rounded-2xl border border-white/10 bg-[#121212]/90 p-4 space-y-2"
                >
                  <div className="text-[11px] font-bold tabular-nums text-primary">{x.step}</div>
                  <div className="text-sm font-semibold text-white">{x.title}</div>
                  <p className="text-xs text-gray-400 leading-relaxed">{x.body}</p>
                </LandingHoverCard>
              ))}
            </div>
          </section>
        ) : null}

        <CertifiedExamsSection onHowItWorks={() => scrollToId('mx-steps')} />

        {showMarketplace ? (
          <section
            id="mx-marketplace"
            className="scroll-mt-24 rounded-2xl border border-white/10 bg-[#121212]/90 p-6 sm:p-8 space-y-4 motion-safe:transition motion-safe:duration-300 motion-safe:hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_16px_40px_-20px_rgba(0,229,176,0.45)]"
          >
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
              {t('landing.marketplace.badge')}
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-white">{t('landing.marketplace.title')}</h2>
            <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">{t('landing.marketplace.desc')}</p>
            <Link
              to="/search"
              onClick={() =>
                trackEvent('mx_landing_marketplace_cta', { surface: 'marketplace_section', action: 'map_search' })
              }
              className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-5 py-3.5 min-h-[48px] text-sm font-bold text-primary hover:bg-primary/20 transition-colors"
            >
              {marketplaceCtaLabel}
            </Link>
          </section>
        ) : null}

        {showUniversities ? (
          <section
            id="mx-universities"
            className="scroll-mt-24 rounded-2xl border border-white/10 bg-[#121212]/90 p-6 sm:p-8 space-y-4 motion-safe:transition motion-safe:duration-300 motion-safe:hover:-translate-y-1 hover:border-white/25 hover:shadow-[0_16px_40px_-20px_rgba(255,255,255,0.12)]"
          >
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
              {t('landing.universities.badge')}
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-white">{t('landing.universities.title')}</h2>
            <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">{t('landing.universities.desc')}</p>
            <Link
              to="/universities"
              onClick={() =>
                trackEvent('mx_landing_universities_cta', { surface: 'universities_section', action: 'open_search' })
              }
              className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-xl border border-white/15 px-5 py-3.5 min-h-[48px] text-sm font-semibold text-gray-100 hover:bg-white/5 transition-colors"
            >
              {t('landing.universities.cta')}
            </Link>
          </section>
        ) : null}

        {showPricing ? (
          <section id="mx-planlar" className="space-y-4 scroll-mt-24">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{t('landing.plansHeading')}</h2>
                <p className="text-sm text-gray-400 max-w-xl">{t('landing.plansIntro')}</p>
              </div>
              <Link
                to="/qiymetler"
                className="text-sm font-semibold text-primary hover:brightness-110 shrink-0"
              >
                {t('landing.plansCompare')} →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {publicPlans.map((p) => (
                <LandingPlanCard key={p.id} plan={p} onCta={() => goRegister('pricing')} />
              ))}
            </div>
          </section>
        ) : null}

        {isMarketingSectionVisible(marketing.faq) && faq.items.length > 0 ? (
          <section id="mx-faq" className="space-y-4 scroll-mt-8">
            <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{faq.heading}</h2>
            <div className="rounded-2xl border border-white/10 bg-surface-2/70 divide-y divide-white/10">
              {faq.items.map((it, i) => (
                <details key={`faq-${i}`} className="group p-4 sm:p-5">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-100 list-none flex items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                    <span>{it.q}</span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/45 bg-primary/15 text-primary text-xl font-bold leading-none group-open:rotate-45 transition-transform">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-xs sm:text-sm text-gray-400 leading-relaxed">{it.a}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}

        {isMarketingSectionVisible(ctaBand) ? (
          <section id="mx-cta" className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-[#0e1412] to-[#0b0b0b] p-6 sm:p-8 scroll-mt-8">
            <div className="space-y-2 max-w-xl">
              <h2 className="text-lg sm:text-xl font-semibold text-white">{ctaBand.heading}</h2>
              <p className="text-sm text-gray-300 leading-relaxed">{ctaBand.subtitle}</p>
            </div>
            <div className="mt-5 max-w-md">
              <button
                type="button"
                onClick={() => goRegister('cta_band')}
                className="w-full inline-flex justify-center items-center text-center rounded-xl bg-primary px-4 sm:px-5 py-3.5 min-h-[48px] text-sm font-bold text-[#041018] shadow-lg shadow-primary/30 hover:brightness-95"
              >
                {hero.primary_cta_label}
              </button>
            </div>
          </section>
        ) : null}

        <PublicSeoFooter className="rounded-none sm:rounded-2xl overflow-hidden" />
      </div>

      {demoOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('landing.demo.dialogLabel')}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDemoTracked()
          }}
        >
          <div className="w-full max-w-2xl max-h-[min(92dvh,800px)] flex flex-col rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl overflow-hidden shadow-black/50">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 bg-[#111] shrink-0">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">{t('landing.demo.title')}</div>
                <div className="text-[11px] text-gray-500">{t('landing.demo.subtitle')}</div>
              </div>
              <button
                type="button"
                className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 shrink-0 min-h-[44px] min-w-[44px]"
                onClick={() => closeDemoTracked()}
              >
                {t('landing.demo.close')}
              </button>
            </div>

            <div className="flex gap-2 p-2 sm:p-2 border-b border-white/10 bg-[#101010] shrink-0 overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]">
              {[
                { id: 'overview', label: t('landing.demo.tabs.overview') },
                { id: 'schedule', label: t('landing.demo.tabs.schedule') },
                { id: 'payments', label: t('landing.demo.tabs.payments') },
                { id: 'attendance', label: t('landing.demo.tabs.attendance') },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onDemoTabTracked(tab.id)}
                  className={`rounded-lg px-4 py-2.5 min-h-[44px] text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    demoTab === tab.id
                      ? 'bg-primary/20 text-primary border border-primary/35'
                      : 'text-gray-400 border border-transparent hover:bg-white/5 hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-h-0 flex flex-col bg-[#0b0b0b]">
              {demoPaneBusy ? (
                <div
                  className="absolute inset-0 z-20 flex items-center justify-center bg-[#0b0b0b]/70 backdrop-blur-[1px] motion-safe:transition-opacity motion-safe:duration-200"
                  aria-hidden
                >
                  <div className="h-9 w-9 rounded-full border-2 border-white/15 border-t-primary motion-safe:animate-spin" />
                </div>
              ) : null}

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <div key={demoTab} className="p-4 pb-3 space-y-4 text-sm animate-demo-enter">
                  {demoTab === 'overview' ? (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          [t('landing.demo.kpis.students'), '8'],
                          [t('landing.demo.kpis.lessons'), '5'],
                          [t('landing.demo.kpis.pendingPay'), '2'],
                          [t('landing.demo.kpis.sms'), '12'],
                        ].map(([k, v]) => (
                          <div key={k} className="rounded-xl border border-white/10 bg-[#151515] p-3">
                            <div className="text-[10px] text-gray-500">{k}</div>
                            <div className="text-lg font-semibold text-white mt-0.5 tabular-nums">{v}</div>
                          </div>
                        ))}
                      </div>
                      <LandingDemoActivityChart />
                    </>
                  ) : null}

                  {demoTab === 'schedule' ? (
                    <div className="space-y-2">
                      {demoSchedule.map((row) => (
                        <div
                          key={`${row.time}-${row.title}`}
                          className="w-full text-left rounded-xl border border-white/10 bg-[#151515] px-3 py-3 flex gap-3 items-center min-h-[52px]"
                        >
                          <div className="rounded-lg bg-primary/15 border border-primary/25 text-primary text-xs font-bold px-2 py-1.5 min-w-[52px] text-center shrink-0">
                            {row.time}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-gray-100 truncate">{row.title}</div>
                            <div className={`text-[11px] mt-0.5 ${row.ok ? 'text-emerald-400/90' : 'text-amber-300/95'}`}>
                              {row.status}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {demoTab === 'payments' ? (
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                      <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wide text-gray-500 bg-[#161616] px-3 py-2 border-b border-white/10">
                        <div className="col-span-5">{t('landing.demo.paymentsTable.student')}</div>
                        <div className="col-span-4">{t('landing.demo.paymentsTable.amount')}</div>
                        <div className="col-span-3 text-right">{t('landing.demo.paymentsTable.status')}</div>
                      </div>
                      {demoPayments.map((row) => (
                        <div
                          key={row.name}
                          className="grid grid-cols-12 gap-2 items-center px-3 py-3 border-b border-white/5 text-xs bg-[#121212]"
                        >
                          <div className="col-span-5 text-gray-200 font-medium truncate min-w-0">{row.name}</div>
                          <div className="col-span-4 text-gray-400 tabular-nums">{row.amount}</div>
                          <div className="col-span-3 text-right">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                                row.tone === 'paid'
                                  ? 'border-emerald-500/35 text-emerald-300 bg-emerald-500/10'
                                  : row.tone === 'pending'
                                    ? 'border-amber-500/35 text-amber-200 bg-amber-500/10'
                                    : 'border-red-500/30 text-red-300 bg-red-500/10'
                              }`}
                            >
                              {row.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {demoTab === 'attendance' ? (
                    <div className="space-y-3">
                      {demoAttendance.map((row) => (
                        <div key={row.label} className="rounded-xl border border-white/10 bg-[#151515] p-3">
                          <div className="flex justify-between text-xs text-gray-200 font-medium mb-2 gap-2">
                            <span className="truncate">{row.label}</span>
                            <span className="text-primary tabular-nums shrink-0">{row.pct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-300/85"
                              style={{ width: `${row.pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="shrink-0 border-t border-white/10 bg-[#0a0a0a]/95 backdrop-blur-md px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  className="w-full rounded-xl bg-primary px-4 py-4 min-h-[52px] text-sm font-bold text-[#041018] shadow-lg shadow-primary/35 hover:brightness-95"
                  onClick={() => goRegister('demo_modal_footer')}
                >
                  {hero.primary_cta_label}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
