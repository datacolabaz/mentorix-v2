/** Cari paket limitləri üzrə istifadə faizi (billing/status mənbəyi). */

export function usagePercent(used, limit) {
  const u = Math.max(0, Number(used) || 0)
  if (limit == null || limit === '') return { pct: 0, used: u, limit: null, label: `${u}/∞` }
  const l = Math.max(0, Number(limit) || 0)
  if (l <= 0) return { pct: u > 0 ? 100 : 0, used: u, limit: l, label: `${u}/${l}` }
  const pct = Math.round((u / l) * 100)
  return { pct, used: u, limit: l, label: `${u}/${l}` }
}

export function pendingSmsQuantity(billing) {
  const n = Number(billing?.pending_topup?.pending_sms_quantity)
  if (Number.isFinite(n) && n > 0) return Math.round(n)
  const items = billing?.pending_topup?.items
  if (!Array.isArray(items)) return 0
  return items.reduce((sum, r) => {
    if (String(r?.product_type || '') !== 'sms') return sum
    return sum + Math.max(0, Math.round(Number(r.sms_quantity) || 0))
  }, 0)
}

/** Paketdən gələn əsas SMS limiti (əlavə balans daxil deyil) */
export function planSmsMonthlyLimit(billing) {
  const plan = billing?.limits?.sms_monthly_plan
  if (plan != null && plan !== '') return Number(plan)
  const extra = Number(billing?.limits?.extra_sms_balance ?? billing?.usage?.extra_sms_balance) || 0
  const effective = billing?.limits?.sms_monthly
  if (effective == null || effective === '') return null
  return Math.max(0, Number(effective) - extra)
}

/** Təsdiqlənmiş əlavə SMS (usage_counters.extra_sms_balance) */
export function extraSmsBalance(billing) {
  return Math.max(
    0,
    Number(billing?.limits?.extra_sms_balance ?? billing?.usage?.extra_sms_balance) || 0,
  )
}

/** Cari effektiv limit = paket + təsdiqlənmiş əlavə SMS */
export function effectiveSmsLimit(billing) {
  const lim = billing?.limits?.sms_monthly
  if (lim == null || lim === '') return null
  return Number(lim)
}

export function smsUsageFromBilling(billing) {
  const used = Number(billing?.usage?.sms_monthly) || 0
  const limit = effectiveSmsLimit(billing)
  return usagePercent(used, limit)
}

export function storageUsageFromBilling(billing) {
  const limB = billing?.limits?.storage_limit_bytes
  const usedB = Number(billing?.usage?.storage_bytes) || 0
  if (limB != null && Number.isFinite(Number(limB)) && Number(limB) > 0) {
    return usagePercent(usedB, Number(limB))
  }
  const usedMb = Number(billing?.usage?.storage_mb) || 0
  const limMb = billing?.limits?.storage_mb ?? null
  return usagePercent(usedMb, limMb)
}

/**
 * Sidebar və pillər üçün: effektiv limit + PRO/əlavə/gözləyən izahı.
 */
export function smsUsageDisplay(billing) {
  const used = Number(billing?.usage?.sms_monthly) || 0
  const effective = effectiveSmsLimit(billing)
  const planBase = planSmsMonthlyLimit(billing)
  const extra = extraSmsBalance(billing)
  const pending = pendingSmsQuantity(billing)
  const core = smsUsageFromBilling(billing)

  const parts = []
  if (planBase != null) parts.push(`paket ${planBase}`)
  if (extra > 0) parts.push(`+${extra} əlavə`)
  if (pending > 0) parts.push(`+${pending} gözləyir`)

  let detail = parts.length ? parts.join(', ') : null
  if (pending > 0 && effective != null) {
    const after = effective + pending
    detail = detail
      ? `${detail} → limit ${after} olacaq`
      : `Təsdiqdən sonra limit ${after} olacaq`
  }

  const overEffective = effective != null && used > effective
  const overPlanOnly = planBase != null && used > planBase && !overEffective
  const smsShortfall =
    overEffective && effective != null ? Math.max(0, Math.ceil(used - effective)) : 0

  return {
    ...core,
    detail,
    pending,
    planBase,
    extra,
    effective,
    overEffective,
    overPlanOnly,
    smsShortfall,
  }
}

export function storageUsageDisplay(billing) {
  const core = storageUsageFromBilling(billing)
  return {
    ...core,
    detail: 'Yaddaş yalnız paket limitindədir; əlavə yaddaş paketi yoxdur',
  }
}
