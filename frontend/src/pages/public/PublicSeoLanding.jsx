import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PublicSeoFooter from '../../components/public/PublicSeoFooter'
import PublicMarketingNav from '../../components/public/PublicMarketingNav'
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
        ? `Mentorix qiymətləri: ${planTitlesLabel}. Müəllim / təlimçi və təşkilat paketləri.`
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
  const ctaClass =
    'inline-flex w-full justify-center items-center rounded-xl bg-primary px-6 py-4 min-h-[52px] text-base font-bold text-[#041018] shadow-lg shadow-primary/20 hover:brightness-95'

  return (
    <div className="min-h-[100svh] bg-[#f4f6fb] text-slate-800 flex flex-col">
      <PublicMarketingNav />

      <main className={`flex-1 ${isPricingPage ? 'max-w-5xl' : 'max-w-3xl'} mx-auto px-4 py-8 sm:py-12 w-full space-y-8`}>
        <div className="space-y-4">
          <Link
            to="/"
            className="inline-flex items-center text-sm font-semibold text-emerald-700 hover:text-emerald-800"
          >
            ← {t('landing.pricingPage.backHome')}
          </Link>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
            Mentorix · {isPanel ? 'təhsil ekosistemi' : 'ictimai axtarış'}
          </p>
          <h1 className="text-[1.85rem] sm:text-4xl font-bold tracking-tight leading-tight text-slate-900">
            {isPricingPage ? t('landing.pricingPage.heading') : landing.h1}
          </h1>
          {isPricingPage ? (
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">{t('landing.pricingPage.intro')}</p>
          ) : (
            landing.intro.map((p) => (
              <p key={p.slice(0, 24)} className="text-base sm:text-lg text-slate-600 leading-relaxed">
                {p}
              </p>
            ))
          )}
        </div>

        {landing.ctaExternal ? (
          <a href={ctaHref} target="_blank" rel="noreferrer" className={ctaClass}>
            {isPricingPage ? t('landing.pricingPage.cta') : landing.ctaLabel}
          </a>
        ) : (
          <Link to={ctaHref} className={ctaClass}>
            {isPricingPage ? t('landing.pricingPage.cta') : landing.ctaLabel}
          </Link>
        )}

        {landing.bullets?.length ? (
          <ul className="space-y-3">
            {landing.bullets.map((b) => (
              <li
                key={b}
                className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-base text-slate-700 shadow-sm"
              >
                <span className="text-emerald-600 shrink-0 text-lg" aria-hidden>
                  ✓
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {landing.showPlatformFeatures ? (
          <section className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Əsas imkanlar</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">Platformada nə edə bilərsiniz</h2>
            <div className="grid gap-3">
              {MENTORIX_PLATFORM_FEATURES.map((f) => (
                <article key={f.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
                  <h3 className="text-lg font-bold text-slate-900">{f.title}</h3>
                  <p className="text-base text-slate-600 leading-relaxed">{f.text}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {landing.showBenefitsList ? (
          <section className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Necə işləyir</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">Boş paneldən nəticəyə</h2>
            <div className="space-y-3">
              {MENTORIX_PLATFORM_BENEFITS.map((b, i) => (
                <article key={b} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">
                    {i + 1}
                  </span>
                  <p className="text-base text-slate-700 leading-relaxed pt-1">{b}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {landing.showPricingPlans ? (
          <section className="space-y-8">
            {showPricingAudience ? <PricingAudienceExplainer variant="faq" /> : null}
            {isPricingPage ? <PublicPricingAudienceGroups plans={plans} /> : null}
            <PublicPricingCompare plans={plans} hideIntro={isPricingPage} tableOnly={isPricingPage} />
          </section>
        ) : null}

        <p className="text-sm text-slate-500 leading-relaxed">
          {isPanel ? (
            <>
              Fərdi müəllim və ya təhsil xidməti təminatçısı — sizə uyğun paketi seçin.{' '}
              <Link to="/search" className="text-emerald-700 font-semibold hover:underline">
                İctimai müəllim axtarışı
              </Link>
              .
            </>
          ) : (
            <>
              Mentorix müəllim, tələbə və valideynləri birləşdirən təhsil ekosistemidir.{' '}
              <Link to="/login" className="text-emerald-700 font-semibold hover:underline">
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
