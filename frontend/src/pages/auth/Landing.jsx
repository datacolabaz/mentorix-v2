import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { trackEvent, trackRegisterClick } from '../../lib/analytics'
import { defaultLoginMarketingPayload } from '../../constants/defaultLoginMarketing'
import { setPageSeo } from '../../lib/pageSeo'
import PublicSeoFooter from '../../components/public/PublicSeoFooter'
import PublicMarketingNav from '../../components/public/PublicMarketingNav'
import { resolveUiLocale } from '../../lib/uiLocale'
import CertifiedExamsSection from '../../components/landing/CertifiedExamsSection'
import HomeHero from '../../components/landing/HomeHero'
import HowItWorks from '../../components/landing/HowItWorks'
import FeatureGrid from '../../components/landing/FeatureGrid'
import AudienceSection from '../../components/landing/AudienceSection'
import TrustSection from '../../components/landing/TrustSection'
import HomeFaq, { useHomeFaqItems } from '../../components/landing/HomeFaq'
import FinalCta from '../../components/landing/FinalCta'
import { isMarketingSectionVisible } from '../../lib/loginMarketingVisibility'
import useAuthStore from '../../hooks/useAuth'
import useUiStore from '../../hooks/useUi'
import { FEATURE_FLAGS, useFeatureFlags } from '../../lib/featureFlags'
import { BRAND } from '../../lib/brand'

const SCROLL_HASHES = new Set(['#mx-features', '#mx-steps', '#mx-faq', '#mx-certified-exams'])

const TRACKED_SECTIONS = [
  'mx-hero',
  'mx-steps',
  'mx-features',
  'mx-audiences',
  'mx-certified-exams',
  'mx-marketplace',
  'mx-trust',
  'mx-faq',
  'mx-cta',
]

function scrollToId(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** Ana səhifə — marketinq landing (/). */
export default function Landing() {
  const { t, i18n } = useTranslation()
  const landingSectionSeenRef = useRef(new Set())
  const [marketing, setMarketing] = useState(() => defaultLoginMarketingPayload())
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()
  const theme = useUiStore((s) => s.theme)
  const faqItems = useHomeFaqItems()

  const { flags: featureFlags } = useFeatureFlags()
  const marketplaceOn = featureFlags[FEATURE_FLAGS.MARKETPLACE] === true
  const showMarketplace = marketplaceOn && isMarketingSectionVisible(marketing.marketplace)
  const showSteps = isMarketingSectionVisible(marketing.steps)
  const showFeatures = isMarketingSectionVisible(marketing.features)
  const showFaq = isMarketingSectionVisible(marketing.faq)

  useEffect(() => {
    setPageSeo({
      title: t('home.seo.title', { brand: BRAND.name }),
      description: t('home.seo.description', { brand: BRAND.name }),
      canonicalPath: '/',
      keywords: t('home.seo.keywords'),
      locale: resolveUiLocale(i18n.language),
      breadcrumbs: [{ name: BRAND.name, path: '/' }],
      faq: showFaq ? faqItems : null,
    })
  }, [t, i18n.language, faqItems, showFaq])

  useEffect(() => {
    if (location.hash === '#mx-planlar') {
      navigate('/qiymetler', { replace: true })
      return
    }
    if (SCROLL_HASHES.has(location.hash)) {
      const id = location.hash.slice(1)
      window.requestAnimationFrame(() => scrollToId(id))
    }
  }, [location.hash, navigate])

  const goRegister = (surface) => {
    trackEvent('mx_landing_cta_primary', { surface, event_type: 'register_click' })
    trackRegisterClick()
    navigate('/login')
  }

  const goLogin = (surface) => {
    if (surface) trackEvent('mx_landing_secondary_click', { action: 'login_nav', surface })
    navigate('/login')
  }

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
    trackEvent('mx_public_landing_view', { path: typeof window !== 'undefined' ? window.location.pathname || '/' : '/' })
  }, [])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined
    const seen = landingSectionSeenRef.current
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
    for (const id of TRACKED_SECTIONS) {
      const el = document.getElementById(id)
      if (el) obs.observe(el)
    }
    return () => obs.disconnect()
  }, [showSteps, showFeatures, showFaq, showMarketplace])

  return (
    <div
      className={[
        // overflow-x must not wrap sticky PublicMarketingNav (overflow-x:hidden forces a scrollport and kills sticky).
        'mx-public-page min-h-[100svh] w-full min-w-0 max-w-full bg-canvas text-fg',
        theme === 'dark' ? 'theme-dark' : 'theme-light',
      ].join(' ')}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[3000] focus:rounded-lg focus:bg-surface-elevated focus:px-4 focus:py-2 focus:text-body-sm focus:font-semibold focus:text-fg focus:shadow-elevated focus:outline-none focus:ring-2 focus:ring-focus"
      >
        {t('home.skipLink')}
      </a>
      <PublicMarketingNav onLogin={() => goLogin('nav')} onStart={() => goRegister('nav')} />

      <main id="main" tabIndex={-1} className="min-w-0 overflow-x-hidden focus:outline-none">
        <HomeHero
          onPrimary={() => goRegister('hero')}
          onSecondary={(e) => {
            e.preventDefault()
            trackEvent('mx_landing_secondary_click', { action: 'how_it_works', surface: 'hero' })
            scrollToId('mx-steps')
          }}
          onLogin={() => goLogin('hero')}
          loggedIn={Boolean(user)}
        />

        {showSteps ? <HowItWorks /> : null}
        {showFeatures ? <FeatureGrid /> : null}
        <AudienceSection />

        <div className="mx-auto max-w-6xl space-y-8 px-4 py-16 sm:px-6 lg:py-20">
          <CertifiedExamsSection onHowItWorks={() => scrollToId('mx-trust')} />

          {showMarketplace ? (
            <section
              id="mx-marketplace"
              aria-labelledby="mx-marketplace-title"
              className="scroll-mt-24 space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8"
            >
              <p className="text-caption font-semibold uppercase tracking-wider text-fg-muted">
                {t('landing.marketplace.badge')}
              </p>
              <h2 id="mx-marketplace-title" className="text-h2 text-fg">
                {t('landing.marketplace.title')}
              </h2>
              <p className="max-w-2xl text-body text-fg-secondary">{t('landing.marketplace.desc')}</p>
              <Link
                to="/search"
                onClick={() =>
                  trackEvent('mx_landing_marketplace_cta', { surface: 'marketplace_section', action: 'map_search' })
                }
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-5 text-button text-fg hover:bg-canvas-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:w-auto"
              >
                {t('landing.hero.marketplaceCta')}
              </Link>
            </section>
          ) : null}
        </div>

        <TrustSection />
        {showFaq ? <HomeFaq /> : null}
        <FinalCta onPrimary={() => goRegister('cta_band')} />
      </main>

      <PublicSeoFooter />
    </div>
  )
}
