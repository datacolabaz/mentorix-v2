/** Paket dəyişməsi: cari istifadə hədəf paket limitlərini aşırmı? */

export function planStudentLimit(p) {
  const n = p?.limits?.students
  if (n == null || n === '') return null
  const v = Number(n)
  return Number.isFinite(v) ? Math.max(0, Math.round(v)) : null
}

export function planStorageByteLimit(p) {
  const b = p?.limits?.storage_limit_bytes
  if (b != null && Number.isFinite(Number(b))) return Number(b)
  const mb = p?.limits?.storage_mb
  if (mb != null && Number.isFinite(Number(mb))) return Math.round(Number(mb) * 1024 * 1024)
  return null
}

export function planSmsMonthlyLimit(p) {
  const n = p?.limits?.sms_monthly
  if (n == null || n === '') return null
  const v = Number(n)
  return Number.isFinite(v) ? Math.max(0, Math.round(v)) : null
}

export function usageFromBilling(billing) {
  const u = billing?.usage || {}
  return {
    students: Number(u.students) || 0,
    storage_bytes: Number(u.storage_bytes) || 0,
    sms_monthly: Number(u.sms_monthly) || 0,
  }
}

/**
 * @returns {{ blocked: boolean, reason: string | null, tooltip: string | null }}
 */
export function downgradeBlockedByUsage(billing, targetPlan) {
  const used = usageFromBilling(billing)
  const maxStudents = planStudentLimit(targetPlan)
  if (maxStudents != null && used.students > maxStudents) {
    return {
      blocked: true,
      reason: 'students',
      tooltip: `Sizin ${used.students} tələbəniz var; bu paket ən çox ${maxStudents} tələbəyə icazə verir.`,
    }
  }

  const maxBytes = planStorageByteLimit(targetPlan)
  if (maxBytes != null && used.storage_bytes > maxBytes) {
    return {
      blocked: true,
      reason: 'storage',
      tooltip: 'Cari yaddaş istifadəniz bu paketin limitindən çoxdur.',
    }
  }

  const maxSms = planSmsMonthlyLimit(targetPlan)
  if (maxSms != null && used.sms_monthly > maxSms) {
    return {
      blocked: true,
      reason: 'sms',
      tooltip: 'Bu ay göndərilmiş SMS sayınız hədəf paketin aylıq limitindən çoxdur.',
    }
  }

  return { blocked: false, reason: null, tooltip: null }
}

/**
 * Ödənişli paketdən (PRO/Premium) aşağı limitli paketə keçid — həmişə bağlı.
 * @returns {{ blocked: boolean, reason: string | null, tooltip: string | null }}
 */
export function downgradeBlockedByTier(currentPlanId, targetPlanId) {
  const from = planRank(currentPlanId)
  const to = planRank(targetPlanId)
  if (to >= from) return { blocked: false, reason: null, tooltip: null }
  if (from >= 2) {
    return {
      blocked: true,
      reason: 'tier',
      tooltip:
        'Daha aşağı limitli paketə keçmək olmaz. Cari paketinizdə əlavə SMS alın və ya yaddaşı idarə edin.',
    }
  }
  return { blocked: false, reason: null, tooltip: null }
}

/** Aşağı paket + istifadə uyğunluğu */
export function planDowngradeGuard(billing, currentPlanId, targetPlan) {
  const tier = downgradeBlockedByTier(currentPlanId, targetPlan?.id)
  if (tier.blocked) return tier
  return downgradeBlockedByUsage(billing, targetPlan)
}

export function planRank(id) {
  const s = String(id || '').toLowerCase()
  if (s === 'business') return 3
  if (s === 'pro') return 2
  return 1
}

function pendingSmsQuantity(billing) {
  const n = Number(billing?.pending_topup?.pending_sms_quantity)
  if (Number.isFinite(n) && n > 0) return Math.round(n)
  const items = billing?.pending_topup?.items
  if (!Array.isArray(items)) return 0
  return items.reduce((sum, r) => {
    if (String(r?.product_type || '') !== 'sms') return sum
    return sum + Math.max(0, Math.round(Number(r.sms_quantity) || 0))
  }, 0)
}

/** Effektiv limit dolub (gözləyən SMS təsdiqi ilə bağlanacaqsa, hələ «dolub» sayılmır) */
export function isSmsMonthlyLimitReached(billing) {
  const lim = billing?.limits?.sms_monthly
  if (lim == null) return false
  const used = Number(billing?.usage?.sms_monthly) || 0
  const pending = pendingSmsQuantity(billing)
  const effective = Number(lim)
  if (pending > 0 && used < effective + pending) return false
  return used >= effective
}

export function hasPendingSmsTopup(billing) {
  return pendingSmsQuantity(billing) > 0
}

export function isStorageLimitReached(billing) {
  const limB = billing?.limits?.storage_limit_bytes
  const usedB = Number(billing?.usage?.storage_bytes) || 0
  if (limB != null && Number.isFinite(Number(limB)) && Number(limB) > 0) {
    return usedB >= Number(limB)
  }
  const limMb = billing?.limits?.storage_mb
  if (limMb == null) return false
  const usedMb = Number(billing?.usage?.storage_mb) || 0
  return usedMb >= Number(limMb)
}

/** SMS: cari paketdə əlavə paket alına bilər (bütün ödənişli paketlər, o cümlədən Premium) */
export function canBuySmsOnCurrentPlan(billing, smsPacksCount = 0) {
  return smsPacksCount > 0
}

/** Cari paketdə limit dolubsa — əlavə SMS və ya (aşağı deyilsə) yüksək paket */
export function shouldOfferLimitTopUpChoice(billing, { smsPacksCount = 0 } = {}) {
  const sms = isSmsMonthlyLimitReached(billing) && canBuySmsOnCurrentPlan(billing, smsPacksCount)
  const storage = isStorageLimitReached(billing)
  if (billing?.is_highest_tier) return sms || storage
  return sms || storage
}
