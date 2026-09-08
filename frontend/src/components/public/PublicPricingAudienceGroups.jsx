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
    </div>
  )
}
