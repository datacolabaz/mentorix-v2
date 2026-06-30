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
import {
  MENTORIX_SEO_DESCRIPTION,
  MENTORIX_SEO_KEYWORDS,
  MENTORIX_SEO_TITLE,
} from '../../lib/mentorixPublicMarketing'
import LandingDemoActivityChart from '../../components/landing/LandingDemoActivityChart'
import LandingHeroSocialProof from '../../components/landing/LandingHeroSocialProof'
import PricingFeatureListItem from '../../components/landing/PricingFeatureListItem'
import PricingAudienceExplainer from '../../components/public/PricingAudienceExplainer'
import { DEFAULT_SUBSCRIPTION_PLANS } from '../../constants/subscriptionPlans'
import {
  normalizePlanId,
} from '../../lib/subscriptionPlanMarketing'
import {
  isMarketingSectionVisible,
} from '../../lib/loginMarketingVisibility'
import { useLandingHero, useLandingWhy, useLandingSteps, useLandingFeatures, useLandingFaq, useLandingUseCase, useLandingCtaBand, useLandingPlanDisplay } from '../../lib/landingCopy'

function scrollToId(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const LANDING_NAV_LINK =
  'mx-landing-nav-link text-gray-300 hover:text-white px-2 py-1.5 rounded-lg'

const LANDING_LOGIN_BTN =
  'shrink-0 whitespace-nowrap rounded-lg bg-primary/15 border border-primary/35 text-primary px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold hover:bg-primary/25'

function LandingPlanCard({ plan, onCta }) {
  const { t, i18n } = useTranslation()
  const display = useLandingPlanDisplay(plan, t, i18n)
  const isBasicTrial = normalizePlanId(plan) === 'basic'
  return (
    <div
      className={[
        'rounded-2xl border p-4 space-y-3 flex flex-col',
        plan.highlight
          ? 'border-primary/40 bg-primary/5 shadow-[0_0_40px_-12px_rgba(0,229,176,0.35)]'
          : 'border-white/10 bg-[#121212]/90',
      ].join(' ')}
    >
      <div>
        <div className="text-sm font-bold text-white">{display.title}</div>
        {display.meta.subtitle ? (
          <p className="text-[11px] text-gray-400 mt-0.5">{display.meta.subtitle}</p>
        ) : null}
        {display.meta.popularLabel ? (
          <p className="text-[11px] font-semibold text-primary mt-1">{display.meta.popularLabel}</p>
        ) : null}
      </div>
      <div className="text-lg font-semibold text-primary tabular-nums">{display.priceLabel}</div>
      <ul className="pricing-feature text-[11px] text-gray-400 space-y-1 flex-1">
        {display.bullets.map((line) => (
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
        className={[
          'w-full rounded-xl px-4 py-2.5 text-xs font-bold transition',
          plan.highlight
            ? 'bg-primary text-[#041018] hover:brightness-95'
            : 'border border-white/15 text-gray-100 hover:bg-white/5',
        ].join(' ')}
      >
        {display.meta.cta}
      </button>
    </div>
  )
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
      title: MENTORIX_SEO_TITLE,
      description: MENTORIX_SEO_DESCRIPTION,
      canonicalPath: '/',
      keywords: MENTORIX_SEO_KEYWORDS,
      breadcrumbs: [
        { name: 'Mentorix', path: '/' },
      ],
    })
  }, [])

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
  const useCase = useLandingUseCase(marketing, t, i18n)
  const ctaBand = useLandingCtaBand(marketing, t, i18n)

  const showMiniPreview = isMarketingSectionVisible(marketing.mini_preview)
  const showMarketplace = isMarketingSectionVisible(marketing.marketplace)
  const showUniversities = isMarketingSectionVisible(marketing.universities)
  const showPricing = isMarketingSectionVisible(marketing.pricing)
  const showPricingAudience = showPricing && marketing.pricing?.audience_explainer_enabled === true

  const goRegister = (surface) => {
    trackEvent('mx_landing_cta_primary', { surface, event_type: 'register_click' })
    trackRegisterClick()
    setDemoOpen(false)
    navigate('/register')
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

  /** Admin-də saxlanan landing mətnləri — API olmadan yalnız defolt göstərilirdi */
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

    const ids = ['mx-demo-mini']
    if (isMarketingSectionVisible(marketing?.why) && why.cards.length > 0) ids.push('mx-why')
    if (isMarketingSectionVisible(marketing.steps) && steps.items.length > 0) ids.push('mx-steps')
    if (isMarketingSectionVisible(marketing.features) && features.items.length > 0) ids.push('mx-features')
    if (useCase?.section_enabled !== false) {
      ids.push('mx-use-case')
    }
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
    useCase?.section_enabled,
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
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <div className="hidden sm:flex items-center gap-1 sm:gap-3 text-xs sm:text-sm font-semibold">
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
                  {showPricing ? (
                    <button
                      type="button"
                      onClick={() => scrollToId('mx-planlar')}
                      className={LANDING_NAV_LINK}
                    >
                      {t('landing.nav.plans')}
                    </button>
                  ) : null}
                </div>
                <LanguageSwitcher tone="dark" className="h-8 sm:h-auto" />
                <button
                  type="button"
                  className="sm:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 hover:text-white"
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
              </div>
            </div>
            {mobileNavOpen ? (
              <div
                id="mx-landing-mobile-nav"
                className="sm:hidden border-t border-white/10 bg-[#0b0b0b]/98 px-3 py-2 space-y-0.5"
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
                {showPricing ? (
                  <button
                    type="button"
                    onClick={() => {
                      closeMobileNav()
                      scrollToId('mx-planlar')
                    }}
                    className={`block w-full text-left ${LANDING_NAV_LINK}`}
                  >
                    {t('landing.nav.plans')}
                  </button>
                ) : null}
              </div>
            ) : null}
          </nav>

        <div className="w-full max-w-5xl mx-auto px-4 pt-8 sm:pt-10 pb-8 space-y-12 sm:space-y-16 min-w-0 box-border overflow-x-hidden">
          <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8 sm:gap-10">
            <div className="max-w-xl w-full space-y-4 flex flex-col items-center text-center sm:items-start sm:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-gray-300">
                <span className="mx-nav-live-dot h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_12px_rgba(0,229,176,0.9)]" />
                {hero.pill}
              </div>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-tight w-full">
                {hero.headline}
              </h1>
              <p className="text-gray-400 text-sm sm:text-base leading-relaxed w-full max-w-md sm:max-w-none">
                {hero.subheadline}
              </p>
              <div className="flex flex-col w-full max-w-xl gap-3">
                <button
                  type="button"
                  onClick={() => goRegister('hero')}
                  className="w-full inline-flex justify-center items-center text-center rounded-xl bg-primary px-4 sm:px-5 py-3.5 min-h-[52px] text-sm sm:text-base font-bold text-[#041018] shadow-lg shadow-primary/25 hover:brightness-95 leading-snug"
                >
                  {hero.primary_cta_label}
                </button>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      trackEvent('mx_landing_secondary_click', { action: 'how_it_works' })
                      scrollToId('mx-steps')
                    }}
                    className="w-full sm:flex-1 inline-flex justify-center items-center rounded-xl border border-white/15 bg-white/5 px-4 py-3 min-h-[44px] text-sm font-semibold text-gray-100 hover:bg-white/10"
                  >
                    {hero.secondary_how}
                  </button>
                  <button
                    type="button"
                    onClick={() => openDemoTracked('hero_demo_button')}
                    className="w-full sm:flex-1 inline-flex justify-center items-center rounded-xl border border-white/10 px-4 py-3 min-h-[44px] text-sm font-semibold text-gray-300 hover:border-white/20 hover:text-white"
                  >
                    {hero.secondary_demo}
                  </button>
                </div>
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

            {showMiniPreview ? (
            <LandingHeroSocialProof onPrimaryCta={() => goRegister('hero_social_proof')} />
            ) : null}
          </header>

          {showMarketplace ? (
          <section
            id="mx-marketplace"
            className="scroll-mt-24 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-[#0e1412] to-[#0b0b0b] p-6 sm:p-8 space-y-4"
          >
            <div className="text-xs uppercase tracking-wider text-primary/90 font-semibold">
              {t('landing.marketplace.badge')}
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-white">{t('landing.marketplace.title')}</h2>
            <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">{t('landing.marketplace.desc')}</p>
            <Link
              to="/search"
              onClick={() =>
                trackEvent('mx_landing_marketplace_cta', { surface: 'marketplace_section', action: 'map_search' })
              }
              className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-xl border-2 border-primary bg-primary/10 px-5 py-3.5 min-h-[48px] text-sm font-bold text-primary hover:bg-primary/20 transition-colors"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className="w-5 h-5 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              {marketplaceCtaLabel}
            </Link>
          </section>
          ) : null}

          {showUniversities ? (
          <section
            id="mx-universities"
            className="scroll-mt-24 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-[#0e1014] to-[#0b0b0b] p-6 sm:p-8 space-y-4"
          >
            <div className="text-xs uppercase tracking-wider text-violet-300/90 font-semibold">
              {t('landing.universities.badge')}
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-white">{t('landing.universities.title')}</h2>
            <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">{t('landing.universities.desc')}</p>
            <Link
              to="/universities"
              onClick={() =>
                trackEvent('mx_landing_universities_cta', { surface: 'universities_section', action: 'open_search' })
              }
              className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-xl border-2 border-violet-400/60 bg-violet-500/10 px-5 py-3.5 min-h-[48px] text-sm font-bold text-violet-200 hover:bg-violet-500/20 transition-colors"
            >
              {t('landing.universities.cta')}
            </Link>
          </section>
          ) : null}

          {isMarketingSectionVisible(marketing?.why) && why.cards.length > 0 ? (
          <section id="mx-why" className="space-y-4 scroll-mt-8">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{why.heading}</div>
            <div className="grid md:grid-cols-3 gap-3">
              {why.cards.map((x, i) => (
                <div key={`why-${i}-${String(x.title).slice(0, 24)}`} className="rounded-2xl border border-white/10 bg-[#121212]/90 p-4 space-y-2">
                  <div className="text-sm font-semibold text-white">{x.title}</div>
                  <p className="text-xs text-gray-400 leading-relaxed">{x.body}</p>
                </div>
              ))}
            </div>
          </section>
          ) : null}

          {isMarketingSectionVisible(marketing.steps) && steps.items.length > 0 ? (
          <section id="mx-steps" className="space-y-4 scroll-mt-8">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{steps.heading}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {steps.items.map((x, i) => (
                <div
                  key={`step-${i}-${String(x.step)}`}
                  className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/10 to-[#101010] p-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary border border-primary/30">
                      {x.step}
                    </span>
                    <div className="text-sm font-semibold text-white">{x.title}</div>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed pl-10">{x.body}</p>
                </div>
              ))}
            </div>
          </section>
          ) : null}

          {isMarketingSectionVisible(marketing.features) && features.items.length > 0 ? (
          <section id="mx-features" className="space-y-4 scroll-mt-8">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{features.heading}</div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5">
              {features.items.map((x, i) => (
                <div
                  key={`feat-${i}`}
                  className={`sm:flex-1 sm:min-w-0 rounded-2xl border border-white/10 bg-gradient-to-br ${x.accent || 'from-sky-500/15'} to-[#101010] p-3 sm:p-3.5 space-y-1.5`}
                >
                  <div className="text-xs sm:text-sm font-semibold text-white leading-snug">{x.title}</div>
                  <p className="text-[10px] sm:text-[11px] text-gray-400 leading-relaxed">{x.body}</p>
                </div>
              ))}
            </div>
          </section>
          ) : null}

          {useCase?.section_enabled !== false ? (
          <section id="mx-use-case" className="space-y-4 scroll-mt-8">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{useCase.heading}</div>
            <div className="rounded-2xl border border-white/10 bg-[#121212]/90 p-5 sm:p-6 space-y-4">
              <p className="text-sm text-gray-200 font-medium">{useCase.title_line}</p>
              <ul className="space-y-2 text-sm text-gray-400 leading-relaxed list-disc pl-5">
                {(useCase.bullets || []).map((b, i) => (
                  <li key={i}>
                    <span className="text-gray-200">{b.lead}</span> {b.rest}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  trackEvent('mx_landing_secondary_click', { action: 'use_case_to_faq' })
                  scrollToId('mx-faq')
                }}
                className="text-xs text-primary hover:brightness-110 font-semibold"
              >
                {useCase.faq_link}
              </button>
            </div>
          </section>
          ) : null}

          {showPricing ? (
          <section id="mx-planlar" className="space-y-4 scroll-mt-24">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{t('landing.plansHeading')}</div>
            {showPricingAudience ? <PricingAudienceExplainer variant="strip" /> : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {publicPlans.map((p) => (
                <LandingPlanCard key={p.id} plan={p} onCta={() => goRegister('pricing')} />
              ))}
            </div>
          </section>
          ) : null}

          {isMarketingSectionVisible(marketing.faq) && faq.items.length > 0 ? (
          <section id="mx-faq" className="space-y-4 scroll-mt-8">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{faq.heading}</div>
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
              <div className="text-lg sm:text-xl font-semibold text-white">{ctaBand.heading}</div>
              <p className="text-sm text-gray-300 leading-relaxed">{ctaBand.subtitle}</p>
            </div>
            <div className="flex flex-col w-full max-w-xl gap-3 mt-5 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => goRegister('cta_band')}
                className="w-full sm:flex-1 inline-flex justify-center items-center text-center rounded-xl bg-primary px-4 sm:px-5 py-3.5 min-h-[48px] text-xs sm:text-sm font-semibold text-[#041018] shadow-lg shadow-primary/30 ring-2 ring-primary/25 hover:brightness-95 leading-snug"
              >
                {hero.primary_cta_label}
              </button>
              <button
                type="button"
                onClick={() => {
                  trackEvent('mx_landing_secondary_click', { action: 'how_it_works' })
                  scrollToId('mx-steps')
                }}
                className="w-full sm:w-auto sm:flex-initial inline-flex justify-center items-center rounded-xl border border-white/20 bg-black/25 px-5 py-3.5 min-h-[48px] text-sm font-semibold text-gray-100 hover:bg-black/35"
              >
                {hero.secondary_how}
              </button>
              <button
                type="button"
                onClick={() => openDemoTracked('cta_band_demo_button')}
                className="w-full sm:w-auto sm:flex-initial inline-flex justify-center items-center rounded-xl border border-white/15 px-5 py-3.5 min-h-[48px] text-sm font-semibold text-gray-100 hover:bg-white/5"
              >
                {hero.secondary_demo}
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
                      ? 'bg-primary/20 text-primary border border-primary/35 shadow-[0_0_20px_-6px_rgba(0,229,176,0.6)]'
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
                          ['Aktiv şagird', '24'],
                          ['Bu həftə dərs', '11'],
                          ['Gözləyən ödəniş', '2'],
                          ['SMS (ay)', '38'],
                        ].map(([k, v]) => (
                          <div
                            key={k}
                            className="rounded-xl border border-white/10 bg-[#151515] p-3 motion-safe:transition motion-safe:duration-300 motion-safe:hover:-translate-y-0.5"
                          >
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
                      {[
                        { t: '17:30', s: 'Riyaziyyat • 10-cu sinif', st: 'Təsdiqlənib', ok: true },
                        { t: '19:00', s: 'İngilis • hazırlıq', st: 'Gözləyir', ok: false },
                        { t: '20:15', s: 'Fizika • qrup', st: 'Təsdiqlənib', ok: true },
                      ].map((row) => (
                        <button
                          key={row.t + row.s}
                          type="button"
                          className="w-full text-left rounded-xl border border-white/10 bg-[#151515] px-3 py-3 flex gap-3 items-center min-h-[52px] hover:bg-white/[0.04] active:scale-[0.99] motion-safe:transition motion-safe:duration-150"
                        >
                          <div className="rounded-lg bg-primary/15 border border-primary/25 text-primary text-xs font-bold px-2 py-1.5 min-w-[52px] text-center shrink-0">
                            {row.t}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-gray-100 truncate">{row.s}</div>
                            <div className={`text-[11px] mt-0.5 ${row.ok ? 'text-emerald-400/90' : 'text-amber-300/95'}`}>{row.st}</div>
                          </div>
                          <span className="text-gray-600 text-lg shrink-0">›</span>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {demoTab === 'payments' ? (
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                      <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wide text-gray-500 bg-[#161616] px-3 py-2 border-b border-white/10">
                        <div className="col-span-5">Şagird</div>
                        <div className="col-span-4">Məbləğ</div>
                        <div className="col-span-3 text-right">Status</div>
                      </div>
                      {[
                        ['Aylan H.', '120 ₼', 'Ödənildi'],
                        ['Murad T.', '80 ₼', 'Gözləyir'],
                        ['Lacin V.', '200 ₼', 'Gecikir'],
                      ].map(([name, amt, st]) => (
                        <div
                          key={name}
                          className="grid grid-cols-12 gap-2 items-center px-3 py-3 border-b border-white/5 text-xs bg-[#121212]"
                        >
                          <div className="col-span-5 text-gray-200 font-medium truncate min-w-0">{name}</div>
                          <div className="col-span-4 text-gray-400 tabular-nums">{amt}</div>
                          <div className="col-span-3 text-right">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                                st === 'Ödənildi'
                                  ? 'border-emerald-500/35 text-emerald-300 bg-emerald-500/10'
                                  : st === 'Gözləyir'
                                    ? 'border-amber-500/35 text-amber-200 bg-amber-500/10'
                                    : 'border-red-500/30 text-red-300 bg-red-500/10'
                              }`}
                            >
                              {st}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {demoTab === 'attendance' ? (
                    <div className="space-y-3">
                      {[
                        ['Bu həftə', 82],
                        ['Keçən həftə', 76],
                        ['Ay ortalaması', 88],
                      ].map(([label, pct]) => (
                        <div key={label} className="rounded-xl border border-white/10 bg-[#151515] p-3">
                          <div className="flex justify-between text-xs text-gray-200 font-medium mb-2 gap-2">
                            <span className="truncate">{label}</span>
                            <span className="text-primary tabular-nums shrink-0">{pct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-300/85 motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="shrink-0 border-t border-white/10 bg-[#0a0a0a]/95 backdrop-blur-md px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3">
                <button
                  type="button"
                  className="w-full rounded-xl bg-primary px-4 py-4 min-h-[52px] text-xs sm:text-sm font-bold text-[#041018] shadow-lg shadow-primary/35 ring-2 ring-primary/30 hover:brightness-95 active:scale-[0.99] motion-safe:transition motion-safe:duration-150 leading-snug text-center"
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
