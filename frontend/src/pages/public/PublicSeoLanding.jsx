import { useEffect, useMemo } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import Brand from '../../components/common/Brand'
import PublicSeoFooter from '../../components/public/PublicSeoFooter'
import PricingAudienceExplainer from '../../components/public/PricingAudienceExplainer'
import { landingByPath, ctaHrefForLanding, MENTORIX_PLATFORM_FEATURES } from '../../lib/publicSeoLandings'
import {
  MENTORIX_ANNUAL_DISCOUNT,
  MENTORIX_PLATFORM_BENEFITS,
  MENTORIX_PRICING_PLANS,
} from '../../lib/mentorixPublicMarketing'
import { setPageSeo } from '../../lib/pageSeo'
import { useSubscriptionPlans } from '../../hooks/useSubscriptionPlans'
import { allActivePlanTitlesList } from '../../lib/subscriptionPlanGuards'

export default function PublicSeoLanding() {
  const { pathname } = useLocation()
  const landing = landingByPath(pathname)
  const plansQ = useSubscriptionPlans()
  const plans = Array.isArray(plansQ.data) ? plansQ.data : []
  const planTitlesLabel = useMemo(() => allActivePlanTitlesList(plans), [plans])

  useEffect(() => {
    if (!landing) return
    const description =
      landing.showPricingPlans && plans.length
        ? `Mentorix paketləri: ${planTitlesLabel}. Müəllimlər və təhsil xidməti təminatçıları üçün — tələbə limiti, SMS və xəritədə görünmə.`
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
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Link to="/login" className="shrink-0" aria-label="Mentorix ana səhifə">
            <Brand className="h-7 w-auto" />
          </Link>
          <Link
            to="/search"
            className="text-sm font-semibold text-primary hover:brightness-110 px-3 py-2 rounded-lg border border-primary/30"
          >
            Xəritə axtarışı
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-4 py-10 sm:py-14 w-full space-y-8">
        <div className="space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
            Mentorix · {isPanel ? 'təhsil ekosistemi' : 'ictimai axtarış'}
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">{landing.h1}</h1>
          {landing.intro.map((p) => (
            <p key={p.slice(0, 24)} className="text-gray-400 text-sm sm:text-base leading-relaxed">
              {p}
            </p>
          ))}
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
          <section className="space-y-4">
            <PricingAudienceExplainer variant="faq" />
            <h2 className="text-lg font-semibold text-white">Paketlərimiz</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {MENTORIX_PRICING_PLANS.map((plan) => (
                <article
                  key={plan.id}
                  className={`rounded-2xl border p-4 sm:p-5 space-y-3 ${
                    plan.highlight
                      ? 'border-primary/45 bg-primary/5 shadow-[0_0_24px_rgba(0,229,176,0.08)]'
                      : 'border-white/10 bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-bold text-white">{plan.title}</h3>
                    <span className="text-xs font-semibold text-primary tabular-nums">{plan.priceLabel}</span>
                  </div>
                  <ul className="space-y-1.5 text-xs sm:text-sm text-gray-400">
                    {plan.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="text-primary shrink-0">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                    {plan.mapNote ? (
                      <li className="flex gap-2 text-gray-300">
                        <span className="text-primary shrink-0">•</span>
                        <span>{plan.mapNote}</span>
                      </li>
                    ) : null}
                  </ul>
                </article>
              ))}
            </div>
            <p className="text-xs text-gray-500">{MENTORIX_ANNUAL_DISCOUNT}</p>
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
            {landing.ctaLabel}
          </a>
        ) : (
          <Link
            to={ctaHref}
            className="inline-flex w-full sm:w-auto justify-center items-center rounded-xl bg-primary px-6 py-4 min-h-[52px] text-sm sm:text-base font-bold text-[#041018] shadow-lg shadow-primary/25 hover:brightness-95"
          >
            {landing.ctaLabel}
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
