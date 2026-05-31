/** İnsan üçün yaddaş həcmi (paket + əlavə limit göstərimi). */

export function formatStorageBytesHuman(bytes) {
  const b = Number(bytes)
  if (!Number.isFinite(b) || b < 0) return '—'
  if (b === 0) return '0 B'
  if (b < 1024 * 1024) {
    const kb = b / 1024
    return kb >= 10 ? `${Math.round(kb)} KB` : `${Math.round(kb * 10) / 10} KB`
  }
  const mb = b / (1024 * 1024)
  if (mb < 1024) return mb >= 10 ? `${Math.round(mb)} MB` : `${Math.round(mb * 10) / 10} MB`
  const gb = mb / 1024
  return gb % 1 === 0 ? `${Math.round(gb)} GB` : `${Math.round(gb * 10) / 10} GB`
}

export function storagePackPeriodLabel(pack) {
  const p = String(pack?.billing_period || 'monthly').toLowerCase()
  if (p === 'monthly' || p === 'month') return '/ ay'
  if (p === 'yearly' || p === 'year') return '/ il'
  return ''
}

export function storagePackHeadline(pack) {
  const label = String(pack?.label || '').trim()
  if (label) return label
  const gb = pack?.quantity_gb
  if (gb != null && Number(gb) >= 1) return `+${gb} GB Sənəd Yaddaşı`
  const mb = Number(pack?.quantity_mb) || 0
  if (mb >= 1024 && mb % 1024 === 0) return `+${mb / 1024} GB Sənəd Yaddaşı`
  return `+${mb} MB Sənəd Yaddaşı`
}
