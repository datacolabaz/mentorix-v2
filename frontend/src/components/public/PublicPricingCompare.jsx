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
    <article
      className={`flex flex-col space-y-3 rounded-2xl border bg-surface p-5 shadow-card sm:p-6 ${plan.highlight ? 'border-brand-text' : 'border-line'}`}
    >
      <div>
        <h3 className="text-h3 text-fg">{display.title}</h3>
        {display.meta.subtitle ? <p className="mt-0.5 text-body-sm text-fg-muted">{display.meta.subtitle}</p> : null}
      </div>
      <div className="text-2xl font-bold tabular-nums text-brand-text">{display.priceLabel}</div>
      <ul className="flex-1 space-y-1.5 text-body-sm text-fg-secondary sm:text-body">
        {display.bullets.map((line) => (
          <PricingFeatureListItem key={`${plan.id}-${line}`} line={line} isBasicTrial={isBasicTrial} />
        ))}
      </ul>
      <Link
        to="/login"
        onClick={onCta}
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-button text-brand-on hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
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

  const compareHeading = t('landing.pricingPage.compareHeading')
  const planTitle = (plan) => t(`landing.plans.${normalizePlanId(plan)}.title`)

  return (
    <section className="space-y-6">
      {hideIntro ? null : (
        <div className="space-y-2">
          <h2 className="text-h2 text-fg">{t('landing.pricingPage.heading')}</h2>
          <p className="max-w-measure text-body leading-relaxed text-fg-secondary">{t('landing.pricingPage.intro')}</p>
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
        <h3 id="mx-pricing-compare" className="text-h3 text-fg">
          {compareHeading}
        </h3>

        {/* Phones: one stacked card per plan (no sideways scrolling, every row label next to its value). */}
        <div className="space-y-3 sm:hidden" data-testid="pricing-compare-mobile">
          {list.map((plan) => (
            <section
              key={plan.id}
              aria-label={planTitle(plan)}
              className="rounded-2xl border border-line bg-surface p-4 shadow-card"
            >
              <h4 className="text-body font-semibold text-fg">{planTitle(plan)}</h4>
              <dl className="mt-2 divide-y divide-line">
                {rows.map((row) => (
                  <div key={row.key} className="flex items-start justify-between gap-3 py-2">
                    <dt className="text-body-sm text-fg-muted">{row.label}</dt>
                    <dd className="text-right text-body-sm font-medium tabular-nums text-fg">{cell(plan, row.key)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        {/* Tablet+: full table; the scroll region is keyboard-focusable and labelled. */}
        <div
          className="hidden overflow-x-auto rounded-2xl border border-line bg-surface shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:block"
          role="region"
          aria-labelledby="mx-pricing-compare"
          tabIndex={0}
          data-testid="pricing-compare-table"
        >
          <table className="w-full min-w-[36rem] text-left text-body-sm">
            <thead className="bg-canvas-subtle text-fg-muted">
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-canvas-subtle px-3 py-3 font-semibold">
                  {compareHeading}
                </th>
                {list.map((plan) => (
                  <th key={plan.id} scope="col" className="whitespace-nowrap px-3 py-3 font-semibold text-fg">
                    {planTitle(plan)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.key} className="bg-surface">
                  <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-surface px-3 py-3 font-medium text-fg-muted">
                    {row.label}
                  </th>
                  {list.map((plan) => (
                    <td key={`${plan.id}-${row.key}`} className="px-3 py-3 tabular-nums text-fg md:whitespace-nowrap">
                      {cell(plan, row.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-body-sm leading-relaxed text-fg-muted">{t('landing.pricingPage.trialNote')}</p>
      <p className="text-body-sm leading-relaxed text-fg-muted">{t('landing.pricingPage.liveNote')}</p>
      <p className="text-body-sm leading-relaxed text-fg-muted">{t('landing.pricingPage.yearlyNote')}</p>
    </section>
  )
}
