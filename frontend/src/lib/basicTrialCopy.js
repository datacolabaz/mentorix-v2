import {
  isBasicPlan,
  isBasicTrialActive,
  isBasicTrialExpired,
} from './subscriptionPlanGuards'

/** SADƏ pulsuz sınaq üçün geri sayım mətni (null = göstərmə). */
export function basicTrialCountdownText(billing, t) {
  if (!isBasicPlan(billing)) return null
  const tr = typeof t === 'function' ? t : (key) => fallbackAz(key)
  if (billing?.basic_trial_ip_denied) {
    return tr('billing.trial.ipDenied')
  }
  if (isBasicTrialExpired(billing)) {
    return tr('billing.trial.expired')
  }
  if (!isBasicTrialActive(billing)) return null

  const days = billing?.subscription?.days_left
  if (days == null) return null
  if (days <= 0) return tr('billing.trial.endsToday')
  if (days === 1) return tr('billing.trial.endsInOneDay')
  return tr('billing.trial.endsInDays', { days })
}

function fallbackAz(key, opts) {
  if (key === 'billing.trial.ipDenied') return 'Bu cihazdan pulsuz sınaq artıq istifadə olunub'
  if (key === 'billing.trial.expired') return 'Pulsuz SADƏ paketin müddəti bitib'
  if (key === 'billing.trial.endsToday') return 'Pulsuz paket bu gün bitir'
  if (key === 'billing.trial.endsInOneDay') return 'Pulsuz paketin bitməsinə 1 gün qalıb'
  if (key === 'billing.trial.endsInDays') return `Pulsuz paketin bitməsinə ${opts?.days ?? ''} gün qalıb`
  return key
}

export function basicTrialEndDateLabel(billing, locale = 'az') {
  const end = billing?.subscription?.current_period_end
  if (!end) return null
  const d = new Date(end)
  if (Number.isNaN(d.getTime())) return null
  const loc = locale === 'ru' ? 'ru-RU' : locale === 'en' ? 'en-GB' : 'az-AZ'
  return d.toLocaleDateString(loc, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Baku',
  })
}
