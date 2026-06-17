import { Link } from 'react-router-dom'
import { basicTrialCountdownText, basicTrialEndDateLabel } from '../../lib/basicTrialCopy'
import { isBasicPlan, isBasicTrialExpired } from '../../lib/subscriptionPlanGuards'

export default function BasicTrialCountdownBanner({
  billing,
  theme = 'dark',
  compact = false,
  className = '',
}) {
  const text = basicTrialCountdownText(billing)
  if (!isBasicPlan(billing) || !text) return null

  const expired = isBasicTrialExpired(billing) || billing?.basic_trial_ip_denied
  // Expired / blocked trial is already shown in the global billing header — avoid duplicate banner.
  if (expired) return null

  const endLabel = basicTrialEndDateLabel(billing)

  return (
    <div
      className={[
        'rounded-2xl border px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 min-w-0',
        theme === 'dark'
          ? 'border-primary/30 bg-primary/10'
          : 'border-emerald-600/25 bg-emerald-50',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="min-w-0">
        <div
          className={[
            'text-sm font-semibold leading-snug',
            theme === 'dark' ? 'text-emerald-100' : 'text-emerald-950',
          ].join(' ')}
        >
          {compact ? `⏳ ${text}` : text}
        </div>
        {endLabel && !compact ? (
          <div
            className={[
              'text-xs mt-0.5',
              theme === 'dark' ? 'text-emerald-200/75' : 'text-emerald-900/70',
            ].join(' ')}
          >
            Bitmə tarixi: {endLabel}
          </div>
        ) : null}
      </div>
      <Link
        to="/instructor/settings"
        state={{ scrollTo: 'billing-plans' }}
        className={[
          'shrink-0 text-xs font-semibold underline-offset-2 hover:underline',
          theme === 'dark' ? 'text-emerald-200' : 'text-emerald-800',
        ].join(' ')}
      >
        Paketlərə bax →
      </Link>
    </div>
  )
}
