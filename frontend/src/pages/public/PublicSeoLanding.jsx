import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Brand from '../../components/common/Brand'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import PublicSeoFooter from '../../components/public/PublicSeoFooter'
import PricingAudienceExplainer from '../../components/public/PricingAudienceExplainer'
import PublicPricingCompare from '../../components/public/PublicPricingCompare'
import PublicPricingAudienceGroups from '../../components/public/PublicPricingAudienceGroups'
import { landingByPath, ctaHrefForLanding, MENTORIX_PLATFORM_FEATURES } from '../../lib/publicSeoLandings'
import { MENTORIX_PLATFORM_BENEFITS } from '../../lib/mentorixPublicMarketing'
import { setPageSeo } from '../../lib/pageSeo'
import { useSubscriptionPlans } from '../../hooks/useSubscriptionPlans'
import { allActivePlanTitlesList } from '../../lib/subscriptionPlanGuards'
import api from '../../lib/api'

export default function PublicSeoLanding() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const landing = landingByPath(pathname)
  const plansQ = useSubscriptionPlans()
  const plans = Array.isArray(plansQ.data) ? plansQ.data : []
  const isPricingPage = landing?.path === '/qiymetler'
  const planTitlesLabel = useMemo(() => allActivePlanTitlesList(plans), [plans])
  const [showPricingAudience, setShowPricingAudience] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const d = await api.get('/public/marketing/login', { params: { _: Date.now() } })
        if (!cancelled) {
          setShowPricingAudience(d?.landing?.pricing?.audience_explainer_enabled === true)
        }
      } catch {
        if (!cancelled) setShowPricingAudience(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!landing) return
    const description =
      landing.showPricingPlans && plans.length
        ? `Mentorix qiymətləri: ${planTitlesLabel}. Müəllim / təlimçi, təşkilat və korporativ paketlər.`
        : landing.description
    setPageSeo({
      title: landing.title,
      description,
      canonicalPath: landing.path,
      keywords: landing.keywords || 'repetitor, müəllim tap, Bakı, Mentorix',
      breadcrumbs: [
        { name: 'Mentorix', path: '/' },
        { name: landing.h1, path: landing.path },
      ],
      pricingProduct: Boolean(landing.showPricingPlans),
    })
  }, [landing, planTitlesLabel, plans.length])

  if (!landing) return <Navigate to="/search" replace />

  const ctaHref = ctaHrefForLanding(landing)
  const isPanel = landing.kind === 'panel' || landing.kind === 'feature'

  return (
    <div className="min-h-[100svh] bg-[#0b0b0b] text-white flex flex-col">
      <header className="border-b border-white/10 bg-[#0f0f0f]/95">
        <div className={`${isPricingPage ? 'max-w-5xl' : 'max-w-3xl'} mx-auto px-4 py-4 flex items-center justify-between gap-3 min-w-0`}>
          <Link to="/" className="shrink-0" aria-label="Mentorix">
            <Brand className="h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher tone="dark" className="h-8" />
            <Link
              to="/search"
              className="text-sm font-semibold text-primary hover:brightness-110 px-3 py-2 rounded-lg border border-primary/30 whitespace-nowrap"
            >
              {t('landing.nav.findTeacher')}
            </Link>
          </div>
        </div>
      </header>

      <main className={`flex-1 ${isPricingPage ? 'max-w-5xl' : 'max-w-3xl'} mx-auto px-4 py-10 sm:py-14 w-full space-y-8`}>
        <div className="space-y-4">
          <Link
            to="/"
            className="inline-flex items-center text-sm font-semibold text-primary hover:brightness-110"
          >
            ← {t('landing.pricingPage.backHome')}
          </Link>
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
            Mentorix · {isPanel ? 'təhsil ekosistemi' : 'ictimai axtarış'}
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
            {isPricingPage ? t('landing.pricingPage.heading') : landing.h1}
          </h1>
          {isPricingPage ? (
            <p className="text-gray-400 text-sm sm:text-base leading-relaxed">{t('landing.pricingPage.intro')}</p>
          ) : (
            landing.intro.map((p) => (
              <p key={p.slice(0, 24)} className="text-gray-400 text-sm sm:text-base leading-relaxed">
                {p}
              </p>
            ))
          )}
        </div>

        {landing.bullets?.length ? (
          <ul className="space-y-2 text-sm text-gray-300">
            {landing.bullets.map((b) => (
              <li key={b} className="flex gap-2">
                <span className="text-primary shrink-0" aria-hidden>
                  ✓
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {landing.showPricingPlans ? (
          <section className="space-y-8">
            {showPricingAudience ? <PricingAudienceExplainer variant="faq" /> : null}
            {isPricingPage ? <PublicPricingAudienceGroups plans={plans} /> : null}
            <PublicPricingCompare plans={plans} hideIntro={isPricingPage} tableOnly={isPricingPage} />
          </section>
        ) : null}

        {landing.showBenefitsList ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Mentorix.io ilə</h2>
            <ul className="space-y-2 text-sm text-gray-300">
              {MENTORIX_PLATFORM_BENEFITS.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="text-primary shrink-0" aria-hidden>
                    ✓
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {landing.showPlatformFeatures ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-semibold text-white">Əsas imkanlar</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {MENTORIX_PLATFORM_FEATURES.map((f) => (
                <div key={f.title} className="space-y-1">
                  <h3 className="text-sm font-semibold text-primary">{f.title}</h3>
                  <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">{f.text}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {landing.ctaExternal ? (
          <a
            href={ctaHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full sm:w-auto justify-center items-center rounded-xl bg-primary px-6 py-4 min-h-[52px] text-sm sm:text-base font-bold text-[#041018] shadow-lg shadow-primary/25 hover:brightness-95"
          >
            {isPricingPage ? t('landing.pricingPage.cta') : landing.ctaLabel}
          </a>
        ) : (
          <Link
            to={ctaHref}
            className="inline-flex w-full sm:w-auto justify-center items-center rounded-xl bg-primary px-6 py-4 min-h-[52px] text-sm sm:text-base font-bold text-[#041018] shadow-lg shadow-primary/25 hover:brightness-95"
          >
            {isPricingPage ? t('landing.pricingPage.cta') : landing.ctaLabel}
          </Link>
        )}

        <p className="text-xs text-gray-500 leading-relaxed">
          {isPanel ? (
            <>
              Fərdi müəllim və ya təhsil xidməti təminatçısı — sizə uyğun paketi seçin.{' '}
              <Link to="/search" className="text-primary hover:underline">
                İctimai müəllim axtarışı
              </Link>
              .
            </>
          ) : (
            <>
              Mentorix müəllim, tələbə və valideynləri birləşdirən təhsil ekosistemidir.{' '}
              <Link to="/login" className="text-primary hover:underline">
                Pulsuz qeydiyyat
              </Link>{' '}
              ilə müəllim profilinizi yarada bilərsiniz.
            </>
          )}
        </p>
      </main>

      <PublicSeoFooter />
    </div>
  )
}
