import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import useAuthStore from '../../hooks/useAuth'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import InstructorEmailAuth from '../../components/auth/InstructorEmailAuth'
import Brand from '../../components/common/Brand'
import api from '../../lib/api'
import { trackEvent, trackRegisterClick, trackPricingView } from '../../lib/analytics'
import { defaultLoginMarketingPayload } from '../../constants/defaultLoginMarketing'
import { setPageSeo } from '../../lib/pageSeo'
import PublicSeoFooter from '../../components/public/PublicSeoFooter'
import {
  MENTORIX_SEO_DESCRIPTION,
  MENTORIX_SEO_HOMEPAGE_LINE,
  MENTORIX_SEO_KEYWORDS,
  MENTORIX_SEO_TITLE,
} from '../../lib/mentorixPublicMarketing'
import { postAuthNavigate } from '../../lib/postAuth'
import LandingDemoActivityChart from '../../components/landing/LandingDemoActivityChart'
import LandingHeroSocialProof from '../../components/landing/LandingHeroSocialProof'
import PricingAudienceExplainer from '../../components/public/PricingAudienceExplainer'
import { DEFAULT_SUBSCRIPTION_PLANS } from '../../constants/subscriptionPlans'
import {
  getPlanMarketingMeta,
  landingPlanFeatureLines,
  landingPlanPriceLabel,
} from '../../lib/subscriptionPlanMarketing'
import { defaultPlatformContact } from '../../lib/platformContact'
import {
  isMarketingSectionVisible,
  visibleMarketingItems,
  visibleWhyCards,
} from '../../lib/loginMarketingVisibility'

function scrollToId(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** Email qeydiyyat/giriş + admin email girişi */
export default function Login() {
  const [searchParams] = useSearchParams()
  const isAdmin = searchParams.get('admin') === 'true'

  useEffect(() => {
    const next = String(searchParams.get('next') || '').trim()
    if (next.startsWith('/') && next !== '/login') {
      try {
        sessionStorage.setItem('mx_return_after_login', next)
      } catch {
        /* ignore */
      }
    }
  }, [searchParams])

  const [adminIdentifier, setAdminIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  /** Əsas CTA — modal; səhifə yüklənəndə / avtomatik açılmır */
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const loginModalPanelRef = useRef(null)

  const loginSectionRef = useRef(null)
  const landingSectionSeenRef = useRef(new Set())
  const [publicPlans, setPublicPlans] = useState(DEFAULT_SUBSCRIPTION_PLANS)
  const [platformContact, setPlatformContact] = useState(() => defaultPlatformContact())
  const [demoOpen, setDemoOpen] = useState(false)
  const [demoTab, setDemoTab] = useState('overview')
  const [demoPaneBusy, setDemoPaneBusy] = useState(false)
  const [marketing, setMarketing] = useState(() => defaultLoginMarketingPayload())

  useEffect(() => {
    setPageSeo({
      title: isAdmin ? 'Mentorix — admin girişi' : MENTORIX_SEO_TITLE,
      description: isAdmin ? 'Mentorix admin panelinə daxil olun.' : MENTORIX_SEO_DESCRIPTION,
      canonicalPath: isAdmin ? '/login?admin=true' : '/login',
      keywords: isAdmin ? undefined : MENTORIX_SEO_KEYWORDS,
      breadcrumbs: isAdmin
        ? [
            { name: 'Mentorix', path: '/' },
            { name: 'Admin girişi', path: '/login' },
          ]
        : [
            { name: 'Mentorix', path: '/' },
            { name: 'Giriş', path: '/login' },
          ],
    })
  }, [isAdmin])

  const whyCardsForLanding = useMemo(() => {
    if (!isMarketingSectionVisible(marketing?.why)) return []
    return visibleWhyCards(marketing?.why?.cards)
  }, [marketing])

  const stepItemsForLanding = useMemo(() => {
    const items = Array.isArray(marketing.steps?.items) ? marketing.steps.items : []
    const def = defaultLoginMarketingPayload().steps.items || []
    const base = items.length ? items : def
    if (!isMarketingSectionVisible(marketing.steps)) return []
    return visibleMarketingItems(base)
  }, [marketing.steps])

  const featureItemsForLanding = useMemo(() => {
    if (!isMarketingSectionVisible(marketing.features)) return []
    return visibleMarketingItems(marketing.features?.items || [])
  }, [marketing.features])

  const faqItemsForLanding = useMemo(() => {
    if (!isMarketingSectionVisible(marketing.faq)) return []
    return visibleMarketingItems(marketing.faq?.items || [])
  }, [marketing.faq])

  const showMiniPreview = isMarketingSectionVisible(marketing.mini_preview)
  const showMarketplace = isMarketingSectionVisible(marketing.marketplace)
  const showUniversities = isMarketingSectionVisible(marketing.universities)
  const showPricing = isMarketingSectionVisible(marketing.pricing)
  const showPricingAudience = showPricing && marketing.pricing?.audience_explainer_enabled === true

  const { login } = useAuthStore()
  const navigate = useNavigate()
  const toast = useToast()

  const roleMap = { admin: '/admin', instructor: '/instructor', student: '/student', parent: '/parent', course: '/course' }

  const goDashboard = (roleOrUser) => {
    const u =
      roleOrUser && typeof roleOrUser === 'object'
        ? roleOrUser
        : useAuthStore.getState().user || { role: roleOrUser }
    postAuthNavigate(u, navigate)
  }

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const user = await login(adminIdentifier, password)
      goDashboard(user.role)
    } catch (err) {
      toast(err.message || 'Giriş xətası', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) return
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
  }, [isAdmin])

  useEffect(() => {
    if (isAdmin) return
    let cancelled = false
    ;(async () => {
      try {
        const d = await api.get('/public/contact')
        if (!cancelled && d?.success && d?.contact) setPlatformContact(d.contact)
      } catch {
        /* default contact */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  /** Admin-də saxlanan landing mətnləri — API olmadan yalnız defolt göstərilirdi */
  useEffect(() => {
    if (isAdmin) return
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
  }, [isAdmin])

  useEffect(() => {
    if (!demoOpen) return
    setDemoPaneBusy(true)
    const id = window.setTimeout(() => setDemoPaneBusy(false), 400)
    return () => window.clearTimeout(id)
  }, [demoOpen, demoTab])

  useEffect(() => {
    if (isAdmin) return
    trackEvent('mx_public_landing_view', { path: typeof window !== 'undefined' ? window.location.pathname || '/login' : '/login' })
  }, [isAdmin])

  useEffect(() => {
    if (isAdmin || typeof IntersectionObserver === 'undefined') return
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
    if (whyCardsForLanding.length > 0) ids.push('mx-why')
    if (stepItemsForLanding.length > 0) ids.push('mx-steps')
    if (featureItemsForLanding.length > 0) ids.push('mx-features')
    if (marketing?.use_case?.section_enabled !== false) {
      ids.push('mx-use-case')
    }
    if (faqItemsForLanding.length > 0) ids.push('mx-faq')
    if (isMarketingSectionVisible(marketing.cta_band)) ids.push('mx-cta')
    ids.push('mx-login')
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
    isAdmin,
    marketing.use_case?.section_enabled,
    marketing.cta_band,
    whyCardsForLanding.length,
    stepItemsForLanding.length,
    featureItemsForLanding.length,
    faqItemsForLanding.length,
  ])

  const closeLoginModal = () => setLoginModalOpen(false)

  const openLoginModal = (surface) => {
    trackEvent('mx_landing_cta_primary', { surface, event_type: 'register_click' })
    trackRegisterClick()
    setDemoOpen(false)
    setLoginModalOpen(true)
  }

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

  const m = marketing

  const marketplaceCtaLabel =
    m.hero?.marketplace_cta_label || defaultLoginMarketingPayload().hero.marketplace_cta_label

  const stepItems = stepItemsForLanding

  useEffect(() => {
    if (!loginModalOpen || isAdmin) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') closeLoginModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [loginModalOpen, isAdmin])

  useEffect(() => {
    if (!loginModalOpen || isAdmin) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [loginModalOpen, isAdmin])

  useEffect(() => {
    if (!loginModalOpen || isAdmin) return
    const id = window.requestAnimationFrame(() => {
      loginModalPanelRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(id)
  }, [loginModalOpen, isAdmin])

  return (
    <div className="min-h-[100svh] w-full min-w-0 max-w-full overflow-x-hidden bg-[#0b0b0b]">
      {!isAdmin ? (
        <>
          <nav
            className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0b0b]/92 backdrop-blur-md supports-[backdrop-filter]:bg-[#0b0b0b]/80"
            aria-label="Əsas naviqasiya"
          >
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <Brand size="md" imgClassName="h-8 w-auto max-w-[120px]" />
              </button>
              <div className="flex items-center gap-1 sm:gap-3 text-xs sm:text-sm font-semibold">
                <Link
                  to="/search"
                  className="hidden sm:inline text-gray-300 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/5"
                >
                  Müəllim tap
                </Link>
                <Link
                  to="/universities"
                  className="text-gray-300 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/5"
                >
                  Universitetlər
                </Link>
                <button
                  type="button"
                  onClick={() => scrollToId(featureItemsForLanding.length ? 'mx-features' : 'mx-steps')}
                  className="text-gray-300 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/5"
                >
                  Xüsusiyyətlər
                </button>
                {showPricing ? (
                <button
                  type="button"
                  onClick={() => scrollToId('mx-pricing')}
                  className="text-gray-300 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/5"
                >
                  Qiymət
                </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => openLoginModal('nav')}
                  className="rounded-lg bg-primary/15 border border-primary/35 text-primary px-3 py-1.5 hover:bg-primary/25"
                >
                  Daxil ol
                </button>
              </div>
            </div>
          </nav>

        <div className="w-full max-w-5xl mx-auto px-4 pt-8 sm:pt-10 pb-8 space-y-12 sm:space-y-16 min-w-0 box-border overflow-x-hidden">
          <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8 sm:gap-10">
            <div className="max-w-xl w-full space-y-4 flex flex-col items-center text-center sm:items-start sm:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-gray-300">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_12px_rgba(0,229,176,0.9)]" />
                {m.hero.pill}
              </div>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-tight w-full">
                {m.hero.headline}
              </h1>
              <p className="text-gray-400 text-sm sm:text-base leading-relaxed w-full max-w-md sm:max-w-none">
                {m.hero.subheadline}
              </p>
              <p className="text-gray-500 text-xs sm:text-sm leading-relaxed w-full max-w-xl">
                {MENTORIX_SEO_HOMEPAGE_LINE}
              </p>
              <div className="flex flex-col w-full max-w-xl gap-3">
                <button
                  type="button"
                  onClick={() => openLoginModal('hero')}
                  className="w-full inline-flex justify-center items-center text-center rounded-xl bg-primary px-4 sm:px-5 py-3.5 min-h-[52px] text-sm sm:text-base font-bold text-[#041018] shadow-lg shadow-primary/25 hover:brightness-95 leading-snug"
                >
                  {m.hero.primary_cta_label}
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
                    {m.hero.secondary_how}
                  </button>
                  <button
                    type="button"
                    onClick={() => openDemoTracked('hero_demo_button')}
                    className="w-full sm:flex-1 inline-flex justify-center items-center rounded-xl border border-white/10 px-4 py-3 min-h-[44px] text-sm font-semibold text-gray-300 hover:border-white/20 hover:text-white"
                  >
                    {m.hero.secondary_demo}
                  </button>
                </div>
              </div>
              <div className="pt-1 w-full">
                <button
                  type="button"
                  onClick={() => {
                    trackEvent('mx_landing_secondary_click', { action: 'existing_account_login' })
                    scrollToId('mx-login')
                  }}
                  className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-4"
                >
                  {m.hero.existing_account}
                </button>
              </div>
            </div>

            {showMiniPreview ? (
            <LandingHeroSocialProof onPrimaryCta={() => openLoginModal('hero_social_proof')} />
            ) : null}
          </header>

          {showMarketplace ? (
          <section
            id="mx-marketplace"
            className="scroll-mt-24 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-[#0e1412] to-[#0b0b0b] p-6 sm:p-8 space-y-4"
          >
            <div className="text-xs uppercase tracking-wider text-primary/90 font-semibold">
              Valideynlər və tələbələr üçün
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-white">Müəllim və təlimçi tapın</h2>
            <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">
              Xəritədən müəllim tapın, universitet proqramlarını müqayisə edin — tələbə və valideynlər üçün qeydiyyat
              pulsuzdur.
            </p>
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
              Xaricdə təhsil
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-white">Universitet və proqram axtarışı</h2>
            <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">
              Bakalavr, magistr və doktorantura proqramlarını ölkə, təqaüd və son müraciət tarixinə görə filtrləyin —
              giriş tələb olunmur.
            </p>
            <Link
              to="/universities"
              onClick={() =>
                trackEvent('mx_landing_universities_cta', { surface: 'universities_section', action: 'open_search' })
              }
              className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-xl border-2 border-violet-400/60 bg-violet-500/10 px-5 py-3.5 min-h-[48px] text-sm font-bold text-violet-200 hover:bg-violet-500/20 transition-colors"
            >
              Proqramları axtar
            </Link>
          </section>
          ) : null}

          {whyCardsForLanding.length > 0 ? (
          <section id="mx-why" className="space-y-4 scroll-mt-8">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{m.why.heading}</div>
            <div className="grid md:grid-cols-3 gap-3">
              {whyCardsForLanding.map((x, i) => (
                <div key={`why-${i}-${String(x.title).slice(0, 24)}`} className="rounded-2xl border border-white/10 bg-[#121212]/90 p-4 space-y-2">
                  <div className="text-sm font-semibold text-white">{x.title}</div>
                  <p className="text-xs text-gray-400 leading-relaxed">{x.body}</p>
                </div>
              ))}
            </div>
          </section>
          ) : null}

          {stepItems.length > 0 ? (
          <section id="mx-steps" className="space-y-4 scroll-mt-8">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{m.steps.heading}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {stepItems.map((x, i) => (
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

          {featureItemsForLanding.length > 0 ? (
          <section id="mx-features" className="space-y-4 scroll-mt-8">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{m.features.heading}</div>
            <div className="grid md:grid-cols-3 gap-3">
              {featureItemsForLanding.map((x, i) => (
                <div
                  key={`feat-${i}`}
                  className={`rounded-2xl border border-white/10 bg-gradient-to-br ${x.accent || 'from-sky-500/15'} to-[#101010] p-4 space-y-2`}
                >
                  <div className="text-sm font-semibold text-white">{x.title}</div>
                  <p className="text-xs text-gray-400 leading-relaxed">{x.body}</p>
                </div>
              ))}
            </div>
          </section>
          ) : null}

          {m.use_case?.section_enabled !== false ? (
          <section id="mx-use-case" className="space-y-4 scroll-mt-8">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{m.use_case.heading}</div>
            <div className="rounded-2xl border border-white/10 bg-[#121212]/90 p-5 sm:p-6 space-y-4">
              <p className="text-sm text-gray-200 font-medium">{m.use_case.title_line}</p>
              <ul className="space-y-2 text-sm text-gray-400 leading-relaxed list-disc pl-5">
                {(m.use_case.bullets || []).map((b, i) => (
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
                {m.use_case.faq_link}
              </button>
            </div>
          </section>
          ) : null}

          {showPricing ? (
          <section id="mx-pricing" className="space-y-4 scroll-mt-24">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Qiymət</div>
            {showPricingAudience ? <PricingAudienceExplainer variant="strip" /> : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {publicPlans.map((p) => {
                const meta = getPlanMarketingMeta(p)
                const bullets = landingPlanFeatureLines(p)
                return (
                <div
                  key={p.id}
                  className={[
                    'rounded-2xl border p-4 space-y-3 flex flex-col',
                    p.highlight
                      ? 'border-primary/40 bg-primary/5 shadow-[0_0_40px_-12px_rgba(0,229,176,0.35)]'
                      : 'border-white/10 bg-[#121212]/90',
                  ].join(' ')}
                >
                  <div>
                    <div className="text-sm font-bold text-white">{p.title}</div>
                    {meta.subtitle ? (
                      <p className="text-[11px] text-gray-400 mt-0.5">{meta.subtitle}</p>
                    ) : null}
                    {meta.popularLabel ? (
                      <p className="text-[11px] font-semibold text-primary mt-1">{meta.popularLabel}</p>
                    ) : null}
                  </div>
                  <div className="text-lg font-semibold text-primary tabular-nums">
                    {landingPlanPriceLabel(p)}
                  </div>
                  <ul className="text-[11px] text-gray-400 space-y-1 flex-1">
                    {bullets.map((line) => (
                      <li key={`${p.id}-${line}`}>• {line}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => openLoginModal('pricing')}
                    className={[
                      'w-full rounded-xl px-4 py-2.5 text-xs font-bold transition',
                      p.highlight
                        ? 'bg-primary text-[#041018] hover:brightness-95'
                        : 'border border-white/15 text-gray-100 hover:bg-white/5',
                    ].join(' ')}
                  >
                    {meta.cta}
                  </button>
                </div>
              )})}
            </div>
          </section>
          ) : null}

          {faqItemsForLanding.length > 0 ? (
          <section id="mx-faq" className="space-y-4 scroll-mt-8">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{m.faq.heading}</div>
            <div className="rounded-2xl border border-white/10 bg-surface-2/70 divide-y divide-white/10">
              {faqItemsForLanding.map((it, i) => (
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

          {isMarketingSectionVisible(m.cta_band) ? (
          <section id="mx-cta" className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-[#0e1412] to-[#0b0b0b] p-6 sm:p-8 scroll-mt-8">
            <div className="space-y-2 max-w-xl">
              <div className="text-lg sm:text-xl font-semibold text-white">{m.cta_band.heading}</div>
              <p className="text-sm text-gray-300 leading-relaxed">{m.cta_band.subtitle}</p>
            </div>
            <div className="flex flex-col w-full max-w-xl gap-3 mt-5 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => openLoginModal('cta_band')}
                className="w-full sm:flex-1 inline-flex justify-center items-center text-center rounded-xl bg-primary px-4 sm:px-5 py-3.5 min-h-[48px] text-xs sm:text-sm font-semibold text-[#041018] shadow-lg shadow-primary/30 ring-2 ring-primary/25 hover:brightness-95 leading-snug"
              >
                {m.hero.primary_cta_label}
              </button>
              <button
                type="button"
                onClick={() => {
                  trackEvent('mx_landing_secondary_click', { action: 'how_it_works' })
                  scrollToId('mx-steps')
                }}
                className="w-full sm:w-auto sm:flex-initial inline-flex justify-center items-center rounded-xl border border-white/20 bg-black/25 px-5 py-3.5 min-h-[48px] text-sm font-semibold text-gray-100 hover:bg-black/35"
              >
                {m.hero.secondary_how}
              </button>
              <button
                type="button"
                onClick={() => openDemoTracked('cta_band_demo_button')}
                className="w-full sm:w-auto sm:flex-initial inline-flex justify-center items-center rounded-xl border border-white/15 px-5 py-3.5 min-h-[48px] text-sm font-semibold text-gray-100 hover:bg-white/5"
              >
                {m.hero.secondary_demo}
              </button>
            </div>
          </section>
          ) : null}

          <PublicSeoFooter className="rounded-none sm:rounded-2xl overflow-hidden" />
        </div>
        </>
      ) : null}

      {!isAdmin && loginModalOpen ? (
        <div
          role="presentation"
          className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-md"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeLoginModal()
          }}
        />
      ) : null}

      <div
        className={`flex w-full min-w-0 max-w-full justify-center overflow-x-hidden ${
          isAdmin
            ? 'min-h-[100svh] items-start px-4 pb-10 pt-8 sm:items-center sm:pt-4'
            : loginModalOpen
              ? 'pointer-events-none fixed inset-0 z-[101] items-stretch justify-center px-0 py-0 sm:items-center sm:px-4 sm:py-6'
              : 'px-4 pb-14 pt-4'
        }`}
      >
        <div
          id="mx-login"
          ref={(node) => {
            loginSectionRef.current = node
            loginModalPanelRef.current = node
          }}
          tabIndex={!isAdmin && loginModalOpen ? -1 : undefined}
          role={!isAdmin && loginModalOpen ? 'dialog' : undefined}
          aria-modal={!isAdmin && loginModalOpen ? true : undefined}
          aria-labelledby={!isAdmin && loginModalOpen ? 'mx-login-modal-title' : undefined}
          className={`w-full max-w-sm scroll-mt-6 ${
            !isAdmin && loginModalOpen
              ? 'pointer-events-auto flex h-full max-h-full min-h-0 flex-col sm:h-auto sm:max-h-[min(92dvh,680px)]'
              : ''
          }`}
        >
          <div
            className={`flex min-h-0 flex-1 flex-col bg-surface-2 ${
              !isAdmin && loginModalOpen
                ? 'min-h-[100dvh] overflow-y-auto overscroll-y-contain rounded-none border-0 p-5 pb-[max(11rem,env(safe-area-inset-bottom,0px))] shadow-2xl sm:min-h-0 sm:pb-6 sm:rounded-2xl sm:border sm:border-white/10 sm:p-6'
                : 'rounded-2xl border border-white/10 p-5 sm:p-6'
            }`}
          >
            {!isAdmin ? (
              loginModalOpen ? (
                <div className="mb-4 shrink-0 px-1">
                  <div className="flex flex-col sm:grid sm:grid-cols-[3rem_1fr_3rem] sm:items-start sm:gap-x-1">
                    <div aria-hidden className="hidden sm:block h-12 w-12" />
                    <div className="order-2 sm:order-none text-center min-w-0 w-full">
                      <h2 id="mx-login-modal-title" className="text-lg font-semibold text-white sm:text-xl">
                        Xoş gəlmisiniz!
                      </h2>
                    </div>
                    <div className="order-1 sm:order-none flex justify-end mb-1.5 sm:mb-0">
                      <button
                        type="button"
                        aria-label="Bağla"
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
                        onClick={closeLoginModal}
                      >
                        <span aria-hidden className="text-3xl font-light leading-none">
                          ×
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-3 text-center space-y-2">
                  <div className="flex justify-center">
                    <Brand size="login" />
                  </div>
                  <div className="text-sm font-semibold text-gray-200">Xoş gəlmisiniz!</div>
                </div>
              )
            ) : (
              <div className="text-center mb-6 sm:mb-8">
                <div className="flex justify-center pt-1 pb-3 bg-transparent">
                  <Brand size="login" />
                </div>
                <div className="text-gray-400 text-sm mt-1">Hesabınıza daxil olun</div>
              </div>
            )}

            {isAdmin && (
              <form onSubmit={handleEmailLogin} className="space-y-4" autoComplete="on">
                <div className="text-center text-red-400 text-xs py-2 px-3 bg-red-500/10 border border-red-500/20 rounded-xl mb-4">
                  Admin panel
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2" htmlFor="admin-username">
                    Telefon və ya email
                  </label>
                  <input
                    id="admin-username"
                    name="username"
                    className="w-full bg-surface-1 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary/40"
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    placeholder="+994XXXXXXXXX və ya admin email"
                    value={adminIdentifier}
                    onChange={(e) => setAdminIdentifier(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2" htmlFor="admin-password">
                    Şifrə
                  </label>
                  <input
                    id="admin-password"
                    name="password"
                    className="w-full bg-surface-1 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary/40"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" loading={loading} className="w-full justify-center py-3">
                  Daxil ol
                </Button>
              </form>
            )}

            {!isAdmin && (
              <InstructorEmailAuth onSuccess={(u) => goDashboard(u)} />
            )}

            <a
              href={platformContact.whatsapp_url}
              target="_blank"
              rel="noreferrer"
              className={`flex items-center justify-center gap-2 rounded-xl border border-primary/50 bg-transparent text-primary font-semibold transition-colors hover:bg-primary/10 ${
                !isAdmin && loginModalOpen ? 'mt-8 min-h-[52px] px-4 py-4 text-base' : 'mt-6 px-4 py-3 text-sm'
              }`}
              onClick={() => trackEvent('mx_landing_whatsapp_click')}
            >
              Bizimlə əlaqə
            </a>
          </div>
        </div>
      </div>

      {demoOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="İnteraktiv demo paneli"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDemoTracked()
          }}
        >
          <div className="w-full max-w-2xl max-h-[min(92dvh,800px)] flex flex-col rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl overflow-hidden shadow-black/50">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 bg-[#111] shrink-0">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">Demo — idarə paneli</div>
                <div className="text-[11px] text-gray-500">Nümunə vizual, real hesab deyil</div>
              </div>
              <button
                type="button"
                className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 shrink-0 min-h-[44px] min-w-[44px]"
                onClick={() => closeDemoTracked()}
              >
                Bağla
              </button>
            </div>

            <div className="flex gap-2 p-2 sm:p-2 border-b border-white/10 bg-[#101010] shrink-0 overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]">
              {[
                { id: 'overview', label: 'Bülgə' },
                { id: 'schedule', label: 'Təqvim' },
                { id: 'payments', label: 'Ödənişlər' },
                { id: 'attendance', label: 'Davamiyyət' },
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
                  onClick={() => openLoginModal('demo_modal_footer')}
                >
                  {m.hero.primary_cta_label}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
