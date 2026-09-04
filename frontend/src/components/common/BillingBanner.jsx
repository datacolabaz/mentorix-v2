import { useTranslation } from 'react-i18next'
import Button from './Button'
import useUiStore from '../../hooks/useUi'

const TITLE_KEYS = {
  warning: 'billing.banner.titleWarning',
  grace: 'billing.banner.titleGrace',
  blocked: 'billing.banner.titleBlocked',
  expired: 'billing.banner.titleExpired',
  pending: 'billing.banner.titlePending',
}

const CTA_KEYS = {
  OPEN_SETTINGS_PLANS: 'billing.cta.viewPlans',
  OPEN_SMS_TOPUP: 'billing.cta.smsTopup',
  OPEN_STORAGE_TOPUP: 'billing.cta.storageTopup',
}

const NEXT_PLAN_SLUG = {
  basic: 'pro',
  pro: 'growth',
  growth: 'premium',
  premium: 'premium',
}

function stylesByStatus(theme) {
  const light = theme !== 'dark'
  return {
    warning: {
      wrap: light
        ? 'border-amber-600/30 bg-amber-50 text-amber-950'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-100',
      ctaClass: light
        ? '!text-amber-950 !border-amber-700/30 hover:!bg-amber-100/70'
        : '',
    },
    grace: {
      wrap: light
        ? 'border-amber-600/30 bg-amber-50 text-amber-950'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-100',
      ctaClass: light
        ? '!text-amber-950 !border-amber-700/30 hover:!bg-amber-100/70'
        : '',
    },
    blocked: {
      wrap: light
        ? 'border-rose-600/30 bg-rose-50 text-rose-950'
        : 'border-rose-500/30 bg-rose-500/10 text-rose-100',
      ctaClass: '',
    },
    expired: {
      wrap: light
        ? 'border-rose-600/30 bg-rose-50 text-rose-950'
        : 'border-rose-500/30 bg-rose-500/10 text-rose-100',
      ctaClass: '',
    },
    pending: {
      wrap: light
        ? 'border-sky-600/25 bg-sky-50 text-sky-950'
        : 'border-sky-500/30 bg-sky-500/10 text-sky-100',
      ctaClass: light
        ? '!text-sky-950 !border-sky-700/30 hover:!bg-sky-100/70'
        : '',
    },
    active: null,
  }
}

function nextPlanName(t, plan) {
  const slug = String(plan || 'basic').toLowerCase()
  const next = NEXT_PLAN_SLUG[slug] || 'pro'
  return t(`billing.planName.${next}`)
}

function localizedExpiredBanner(t, plan, basicTrialIpDenied) {
  const planSlug = String(plan || '').toLowerCase()
  if (planSlug === 'basic') {
    const higherPlan = t('billing.higherPlanOrAbove', { plan: nextPlanName(t, 'basic') })
    if (basicTrialIpDenied) {
      return t('billing.banner.basicTrialIpDenied', { higherPlan })
    }
    return t('billing.banner.basicTrialExpired', { higherPlan })
  }
  return t('billing.banner.subscriptionExpired')
}

export default function BillingBanner({
  status,
  banner,
  cta,
  onCta,
  tone,
  plan,
  basicTrialIpDenied,
}) {
  const { t } = useTranslation()
  const { theme } = useUiStore()
  const s = tone === 'pending' ? 'pending' : String(status || 'active')
  const meta = stylesByStatus(theme)[s]
  if (!meta) return null
  if (!banner && !cta && s !== 'expired') return null

  const title = TITLE_KEYS[s] ? t(TITLE_KEYS[s]) : ''
  const displayBanner =
    s === 'expired' ? localizedExpiredBanner(t, plan, basicTrialIpDenied) : banner || '—'

  const action = cta && typeof cta === 'object' ? cta.action : null
  const apiLabel = cta && typeof cta === 'object' ? cta.label : cta
  const ctaLabel = action && CTA_KEYS[action] ? t(CTA_KEYS[action]) : apiLabel

  if (!displayBanner && !ctaLabel) return null

  return (
    <div className={`rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${meta.wrap}`}>
      <div className="min-w-0">
        <div className="text-xs font-bold uppercase tracking-wide opacity-90">{title}</div>
        <div className="text-sm font-semibold break-words">{displayBanner || '—'}</div>
      </div>
      {ctaLabel ? (
        <Button
          variant={s === 'warning' || s === 'grace' ? 'secondary' : 'primary'}
          size="sm"
          onClick={onCta}
          className={meta.ctaClass || ''}
        >
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  )
}
