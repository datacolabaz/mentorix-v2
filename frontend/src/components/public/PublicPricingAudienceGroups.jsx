import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DEFAULT_SUBSCRIPTION_PLANS } from '../../constants/subscriptionPlans'
import { plansForAudience } from '../../lib/landingCopy'
import { PricingPlanCard } from './PublicPricingCompare'

function AudiencePlanGrid({ title, intro, plans, onCta }) {
  if (!plans.length) return null
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {intro ? <p className="text-sm text-gray-400 leading-relaxed">{intro}</p> : null}
      </div>
      <div className={`grid gap-3 ${plans.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {plans.map((plan) => (
          <PricingPlanCard key={plan.id} plan={plan} onCta={onCta} />
        ))}
      </div>
    </section>
  )
}

export default function PublicPricingAudienceGroups({ plans, onCta }) {
  const { t } = useTranslation()
  const list = Array.isArray(plans) && plans.length ? plans : DEFAULT_SUBSCRIPTION_PLANS
  const teacher = plansForAudience(list, 'teacher')
  const center = plansForAudience(list, 'center')
  const corporateRaw = t('landing.pricingPage.groups.corporate', { returnObjects: true })
  const corporate =
    corporateRaw && typeof corporateRaw === 'object' && !Array.isArray(corporateRaw) ? corporateRaw : {}

  return (
    <div className="space-y-10">
      <AudiencePlanGrid
        title={t('landing.pricingPage.groups.teacher.title')}
        intro={t('landing.pricingPage.groups.teacher.intro')}
        plans={teacher}
        onCta={onCta}
      />
      <AudiencePlanGrid
        title={t('landing.pricingPage.groups.center.title')}
        intro={t('landing.pricingPage.groups.center.intro')}
        plans={center}
        onCta={onCta}
      />
      <section className="rounded-2xl border border-primary/35 bg-primary/5 p-5 sm:p-6 space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
          {corporate.title}
        </p>
        <h2 className="text-lg sm:text-xl font-semibold text-white">{corporate.headline}</h2>
        <p className="text-sm text-gray-300 leading-relaxed max-w-2xl">{corporate.body}</p>
        <Link
          to="/elaqe"
          className="inline-flex justify-center items-center rounded-xl bg-primary px-5 py-3 min-h-[44px] text-sm font-bold text-[#041018] hover:brightness-95"
        >
          {corporate.cta}
        </Link>
      </section>
    </div>
  )
}
