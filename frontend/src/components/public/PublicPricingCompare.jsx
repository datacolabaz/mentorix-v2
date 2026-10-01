import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DEFAULT_SUBSCRIPTION_PLANS } from '../../constants/subscriptionPlans'
import { resolveAiPlanLimits } from '../../constants/aiPlanLimits'
import { normalizePlanId } from '../../lib/subscriptionPlanMarketing'
import { cloudStorageCompareValue } from '../../lib/subscriptionPlanCopy'
import { useLandingPlanDisplay } from '../../lib/landingCopy'
import PricingFeatureListItem from '../landing/PricingFeatureListItem'

function limitLabel(value, unlimitedLabel) {
  if (value == null || value === '') return unlimitedLabel
  return String(value)
}

export function PricingPlanCard({ plan, onCta }) {
  const { t, i18n } = useTranslation()
  const display = useLandingPlanDisplay(plan, t, i18n)
  const isBasicTrial = normalizePlanId(plan) === 'basic'
  return (
    <article className={`flex flex-col space-y-3 rounded-2xl border bg-white p-5 shadow-sm sm:p-6 ${plan.highlight ? 'border-emerald-400' : 'border-slate-200'}`}>
      <div>
        <h3 className="text-base font-bold text-slate-900">{display.title}</h3>
        {display.meta.subtitle ? <p className="mt-0.5 text-sm text-slate-500">{display.meta.subtitle}</p> : null}
      </div>
      <div className="text-2xl font-bold tabular-nums text-emerald-700">{display.priceLabel}</div>
      <ul className="flex-1 space-y-1.5 text-sm text-slate-600 sm:text-base">
        {display.bullets.map((line) => (
          <PricingFeatureListItem key={`${plan.id}-${line}`} line={line} isBasicTrial={isBasicTrial} />
        ))}
      </ul>
      <Link
        to="/login"
        onClick={onCta}
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-[#041018] hover:brightness-95"
      >
        {display.meta.cta || t('landing.pricingPage.cta')}
      </Link>
    </article>
  )
}

export default function PublicPricingCompare({ plans, onCta, hideIntro = false, tableOnly = false }) {
  const { t, i18n } = useTranslation()
  const list = Array.isArray(plans) && plans.length ? plans : DEFAULT_SUBSCRIPTION_PLANS
  const unlimited = t('landing.plans.unlimited')
  const dash = t('landing.pricingPage.dash', { defaultValue: '—' })

  const rows = [
    { key: 'price', label: t('landing.pricingPage.rows.price') },
    { key: 'students', label: t('landing.pricingPage.rows.students') },
    { key: 'cloudStorage', label: t('landing.pricingPage.rows.cloudStorage') },
    { key: 'exams', label: t('landing.pricingPage.rows.exams') },
    { key: 'assignments', label: t('landing.pricingPage.rows.assignments') },
    { key: 'aiQuestions', label: t('landing.pricingPage.rows.aiQuestions') },
    { key: 'aiGradings', label: t('landing.pricingPage.rows.aiGradings') },
    { key: 'liveLessons', label: t('landing.pricingPage.rows.liveLessons') },
    { key: 'emailNotifications', label: t('landing.pricingPage.rows.emailNotifications') },
  ]

  const cell = (plan, key) => {
    const id = normalizePlanId(plan)
    const lim = plan?.limits || {}
    if (key === 'price') {
      const v = Number(plan?.price_azn)
      if (!Number.isFinite(v) || v <= 0) return t('landing.plans.trialPrice')
      return t('landing.plans.pricePerMonth', { price: v })
    }
    if (key === 'students') return limitLabel(lim.students, unlimited)
    if (key === 'cloudStorage') return cloudStorageCompareValue(plan, { t, lang: i18n.language }) || dash
    if (key === 'exams') return limitLabel(lim.exams_monthly, unlimited)
    if (key === 'assignments') return limitLabel(lim.homeworks_monthly, unlimited)
    if (key === 'aiQuestions' || key === 'aiGradings') {
      const ai = resolveAiPlanLimits(plan)
      const n = key === 'aiQuestions' ? ai.questions : ai.gradings
      if (ai.isTrial) return String(n)
      return t('landing.pricingPage.perMonth', { count: n })
    }
    if (key === 'liveLessons') return t('landing.pricingPage.liveLessonsCell')
    if (key === 'emailNotifications') {
      return id === 'basic' ? t('landing.pricingPage.emailLimited') : t('landing.pricingPage.emailFull')
    }
    return id
  }

  return (
    <section className="space-y-6">
      {hideIntro ? null : (
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">{t('landing.pricingPage.heading')}</h2>
          <p className="text-base leading-relaxed text-slate-600">{t('landing.pricingPage.intro')}</p>
        </div>
      )}

      {tableOnly ? null : (
        <div className="grid gap-3 sm:grid-cols-3">
          {list.map((plan) => (
            <PricingPlanCard key={plan.id} plan={plan} onCta={onCta} />
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-lg font-bold text-slate-900">{t('landing.pricingPage.compareHeading')}</h3>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-slate-50 px-3 py-3 font-semibold">
                  {t('landing.pricingPage.compareHeading')}
                </th>
                {list.map((plan) => (
                  <th key={plan.id} scope="col" className="whitespace-nowrap px-3 py-3 font-semibold text-slate-900">
                    {t(`landing.plans.${normalizePlanId(plan)}.title`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.key} className="bg-white">
                  <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-3 font-medium text-slate-500">
                    {row.label}
                  </th>
                  {list.map((plan) => (
                    <td key={`${plan.id}-${row.key}`} className="px-3 py-3 tabular-nums text-slate-800 sm:whitespace-nowrap">
                      {cell(plan, row.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-slate-500">{t('landing.pricingPage.trialNote')}</p>
      <p className="text-sm leading-relaxed text-slate-500">{t('landing.pricingPage.liveNote')}</p>
      <p className="text-sm leading-relaxed text-slate-500">{t('landing.pricingPage.yearlyNote')}</p>
    </section>
  )
}
