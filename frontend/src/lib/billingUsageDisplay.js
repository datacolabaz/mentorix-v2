/** Cari paket limitləri üzrə istifadə faizi (billing/status mənbəyi). */

export function usagePercent(used, limit) {
  const u = Math.max(0, Number(used) || 0)
  if (limit == null || limit === '') return { pct: 0, used: u, limit: null, label: `${u}/∞` }
  const l = Math.max(0, Number(limit) || 0)
  if (l <= 0) return { pct: u > 0 ? 100 : 0, used: u, limit: l, label: `${u}/${l}` }
  const pct = Math.round((u / l) * 100)
  return { pct, used: u, limit: l, label: `${u}/${l}` }
}

export function smsUsageFromBilling(billing) {
  const used = Number(billing?.usage?.sms_monthly) || 0
  const limit = billing?.limits?.sms_monthly ?? null
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
