/** Paket kartlarında limit sətirləri (API: items və ya limits). */

function formatStorageFromLimits(lim) {
  if (!lim) return null
  const bytes = lim.storage_limit_bytes
  if (bytes != null && Number.isFinite(Number(bytes))) {
    const b = Number(bytes)
    if (b > 0 && b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB yaddaş`
    const mb = b / (1024 * 1024)
    return mb >= 10 ? `${Math.round(mb)} MB yaddaş` : `${Math.round(mb * 10) / 10} MB yaddaş`
  }
  const mb = lim.storage_mb
  if (mb != null && Number.isFinite(Number(mb))) {
    const gb = Number(mb) / 1024
    if (gb >= 1) return `${gb % 1 === 0 ? Math.round(gb) : Math.round(gb * 10) / 10} GB yaddaş`
    return `${Math.round(Number(mb))} MB yaddaş`
  }
  if (lim.storage_mb === null && lim.storage_limit_bytes === null) return 'Limitsiz yaddaş'
  return null
}

export function planLimitFeatureLines(p) {
  const items = Array.isArray(p?.items)
    ? p.items.map((x) => String(x || '').trim()).filter(Boolean)
    : []
  if (items.length) return items

  const lim = p?.limits
  if (!lim) return []

  const lines = []
  if (lim.students == null) lines.push('Limitsiz tələbə')
  else lines.push(`${Math.max(0, Math.round(Number(lim.students)))} tələbə`)

  const storage = formatStorageFromLimits(lim)
  if (storage) lines.push(storage)
  else if (lim.storage_mb == null && lim.storage_limit_bytes == null) lines.push('Limitsiz yaddaş')

  if (lim.sms_monthly == null) lines.push('Limitsiz SMS / ay')
  else lines.push(`${Math.max(0, Math.round(Number(lim.sms_monthly)))} SMS / ay`)

  return lines
}

/** Qısa başlıq (kartın üstündəki birinci sətir). */
export function planLimitsHeadline(p) {
  const lines = planLimitFeatureLines(p)
  if (lines.length) return lines[0]
  return 'Limitlər mövcud paketə uyğun tətbiq olunur.'
}

/** Kartda SADƏ kimi tam izah (bütün paketlər). */
export function planDetailLines(p) {
  const id = String(p?.id || '').toLowerCase()
  const features = planLimitFeatureLines(p)
  const limitsText = features.length ? features.join(', ') : null
  const price = Number(p?.price_azn)
  const isPaid = id !== 'basic' && Number.isFinite(price) && price > 0

  if (id === 'basic') {
    return [
      'Bu paketdə istifadə müddəti məhdud deyil.',
      limitsText ? `${limitsText} mövcuddur.` : 'Limitlər pulsuz paketə uyğun tətbiq olunur.',
      'Limitlərə çatdıqda daha geniş paket seçməyiniz tələb olunacaq.',
    ]
  }

  if (isPaid) {
    const lines = [
      'Aylıq və ya illik ödənişlə aktiv abunədir; ödəniş təsdiqlənəndən sonra limitlər dərhal tətbiq olunur.',
    ]
    if (limitsText) lines.push(`Paketə daxildir: ${limitsText}.`)
    if (id === 'business') {
      lines.push('Ən geniş paket — limitsiz tələbə və yüksək SMS/yaddaş həcmi üçün.')
    } else {
      lines.push('Limitlərə çatdıqda daha geniş paket seçməyiniz tələb olunacaq.')
    }
    return lines
  }

  return limitsText ? [`${limitsText}.`] : ['Limitlər mövcud paketə uyğun tətbiq olunur.']
}
