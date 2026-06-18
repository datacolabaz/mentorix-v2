/** Materiallar kitabxanası paket limitləri (backend ilə uyğun) */

export const MATERIALS_MAX_SINGLE_FILE_BYTES = 25 * 1024 * 1024

export const MATERIALS_STORAGE_LIMIT_MESSAGE =
  'Yaddaş limitiniz dolub. Daha çox material yükləmək üçün paketinizi yeniləyin.'

export const MATERIALS_PLAN_LIMITS = {
  basic: { storageBytes: 50 * 1024 * 1024, maxFiles: 5 },
  pro: { storageBytes: 2 * 1024 * 1024 * 1024, maxFiles: null },
  growth: { storageBytes: 5 * 1024 * 1024 * 1024, maxFiles: null },
  premium: { storageBytes: 20 * 1024 * 1024 * 1024, maxFiles: null },
}

export function formatMaterialsBytes(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function isMaterialsQuotaFull(quota) {
  if (!quota) return false
  if (quota.limit_reached) return true
  const used = Number(quota?.usage?.used_bytes) || 0
  const limit = quota?.limits?.storage_bytes
  if (limit != null && used >= limit) return true
  const maxFiles = quota?.limits?.max_files
  const count = Number(quota?.usage?.file_count) || 0
  return maxFiles != null && count >= maxFiles
}

export function materialsUsagePercent(quota) {
  const used = Number(quota?.usage?.used_bytes) || 0
  const limit = quota?.limits?.storage_bytes
  if (limit == null || limit <= 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}
