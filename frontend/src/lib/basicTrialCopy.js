import {
  isBasicPlan,
  isBasicTrialActive,
  isBasicTrialExpired,
} from './subscriptionPlanGuards'

/** SADƏ pulsuz sınaq üçün geri sayım mətni (null = göstərmə). */
export function basicTrialCountdownText(billing) {
  if (!isBasicPlan(billing)) return null
  if (billing?.basic_trial_ip_denied) {
    return 'Bu cihazdan pulsuz sınaq artıq istifadə olunub'
  }
  if (isBasicTrialExpired(billing)) {
    return 'Pulsuz SADƏ paketin müddəti bitib'
  }
  if (!isBasicTrialActive(billing)) return null

  const days = billing?.subscription?.days_left
  if (days == null) return null
  if (days <= 0) return 'Pulsuz paket bu gün bitir'
  if (days === 1) return 'Pulsuz paketin bitməsinə 1 gün qalıb'
  return `Pulsuz paketin bitməsinə ${days} gün qalıb`
}

export function basicTrialEndDateLabel(billing) {
  const end = billing?.subscription?.current_period_end
  if (!end) return null
  const d = new Date(end)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('az-AZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Baku',
  })
}
