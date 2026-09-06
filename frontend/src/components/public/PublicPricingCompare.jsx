import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DEFAULT_SUBSCRIPTION_PLANS } from '../../constants/subscriptionPlans'
import { normalizePlanId } from '../../lib/subscriptionPlanMarketing'
import { useLandingPlanDisplay } from '../../lib/landingCopy'
import PricingFeatureListItem from '../landing/PricingFeatureListItem'

const LIVE_FALLBACK = { basic: 5, pro: 20, growth: 50, premium: null }

function limitLabel(value, unlimitedLabel) {
  if (value == null || value === '') return unlimitedLabel
  return String(value)
}

function liveLimit(plan) {
  const fromPlan = plan?.limits?.live_participants
  if (fromPlan !== undefined) return fromPlan
  const id = normalizePlanId(plan)
  return Object.prototype.hasOwnProperty.call(LIVE_FALLBACK, id) ? LIVE_FALLBACK[id] : null
}

function PlanCard({ plan, onCta }) {
  const { t, i18n } = useTranslation()
  const display = useLandingPlanDisplay(plan, t, i18n)
  const isBasicTrial = normalizePlanId(plan) === 'basic'
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 space-y-3 flex flex-col">
      <div>
        <h3 className="text-sm font-bold text-white">{display.title}</h3>
        {display.meta.subtitle ? (
          <p className="text-[11px] text-gray-400 mt-0.5">{display.meta.subtitle}</p>
        ) : null}
      </div>
      <div className="text-lg font-semibold text-primary tabular-nums">{display.priceLabel}</div>
      <ul className="space-y-1.5 text-xs sm:text-sm text-gray-400 flex-1">
        {display.bullets.map((line) => (
          <PricingFeatureListItem key={`${plan.id}-${line}`} line={line} isBasicTrial={isBasicTrial} />
        ))}
      </ul>
      <Link
        to="/login"
        onClick={onCta}
        className="inline-flex justify-center items-center rounded-xl bg-primary px-4 py-2.5 min-h-[44px] text-xs font-bold text-[#041018] hover:brightness-95"
      >
        {t('landing.pricingPage.cta')}
      </Link>
    </article>
  )
}

export default function PublicPricingCompare({ plans, onCta, hideIntro = false, tableOnly = false }) {
  const { t } = useTranslation()
  const list = Array.isArray(plans) && plans.length ? plans : DEFAULT_SUBSCRIPTION_PLANS
  const unlimited = t('landing.plans.unlimited')

  const rows = [
    { key: 'price', label: t('landing.pricingPage.rows.price') },
    { key: 'students', label: t('landing.pricingPage.rows.students') },
    { key: 'documents', label: t('landing.pricingPage.rows.documents') },
    { key: 'exams', label: t('landing.pricingPage.rows.exams') },
    { key: 'assignments', label: t('landing.pricingPage.rows.assignments') },
    { key: 'sms', label: t('landing.pricingPage.rows.sms') },
    { key: 'live', label: t('landing.pricingPage.rows.live') },
  ]

  const cell = (plan, key) => {
    const id = normalizePlanId(plan)
    const lim = plan?.limits || {}
    if (key === 'price') {
      const v = Number(plan?.price_azn)
      if (!Number.isFinite(v) || v <= 0) return t('landing.plans.free')
      return t('landing.plans.pricePerMonth', { price: v })
    }
    if (key === 'students') return limitLabel(lim.students, unlimited)
    if (key === 'documents') return limitLabel(lim.documents, unlimited)
    if (key === 'exams') return limitLabel(lim.exams_monthly, unlimited)
    if (key === 'assignments') return limitLabel(lim.homeworks_monthly, unlimited)
    if (key === 'sms') return limitLabel(lim.sms_monthly, unlimited)
    if (key === 'live') return limitLabel(liveLimit(plan), unlimited)
    return id
  }

  return (
    <section className="space-y-6">
      {hideIntro ? null : (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-white">{t('landing.pricingPage.heading')}</h2>
          <p className="text-sm text-gray-400 leading-relaxed">{t('landing.pricingPage.intro')}</p>
        </div>
      )}

      {tableOnly ? null : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onCta={onCta} />
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white">{t('landing.pricingPage.compareHeading')}</h3>
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[36rem] text-left text-xs sm:text-sm">
            <thead className="bg-[#161616] text-gray-400">
              <tr>
                <th className="px-3 py-2.5 font-semibold sticky left-0 bg-[#161616] z-10">{t('landing.pricingPage.compareHeading')}</th>
                {list.map((plan) => (
                  <th key={plan.id} className="px-3 py-2.5 font-semibold text-white whitespace-nowrap">
                    {t(`landing.plans.${normalizePlanId(plan)}.title`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((row) => (
                <tr key={row.key} className="bg-[#101010]">
                  <th className="px-3 py-2.5 font-medium text-gray-400 sticky left-0 bg-[#101010] z-10 whitespace-nowrap">
                    {row.label}
                  </th>
                  {list.map((plan) => (
                    <td key={`${plan.id}-${row.key}`} className="px-3 py-2.5 text-gray-200 tabular-nums whitespace-nowrap">
                      {cell(plan, row.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">{t('landing.pricingPage.trialNote')}</p>
      <p className="text-xs text-gray-500 leading-relaxed">{t('landing.pricingPage.yearlyNote')}</p>
    </section>
  )
}
