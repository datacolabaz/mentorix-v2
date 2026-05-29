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

export function planRank(id) {
  const s = String(id || '').toLowerCase()
  if (s === 'business') return 3
  if (s === 'pro') return 2
  return 1
}

export function isSmsMonthlyLimitReached(billing) {
  const lim = billing?.limits?.sms_monthly
  if (lim == null) return false
  const used = Number(billing?.usage?.sms_monthly) || 0
  return used >= Number(lim)
}
