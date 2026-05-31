/** Paket kartlarında limit sətirləri (API: items və ya limits). */

function storageLabelFromBytes(bytes) {
  const b = Number(bytes)
  if (!Number.isFinite(b) || b <= 0) return null
  if (b === 5 * 1024 * 1024) return '5 MB Sənəd Yaddaşı'
  if (b === 256 * 1024 * 1024) return '256 MB Sənəd Yaddaşı'
  if (b === 1024 * 1024 * 1024) return '1 GB Sənəd Yaddaşı'
  if (b === 2048 * 1024 * 1024) return '2 GB Sənəd Yaddaşı'
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB Sənəd Yaddaşı`
  const mb = b / (1024 * 1024)
  if (mb >= 1024) {
    const gb = mb / 1024
    return `${gb % 1 === 0 ? Math.round(gb) : Math.round(gb * 10) / 10} GB Sənəd Yaddaşı`
  }
  return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} MB Sənəd Yaddaşı`
}

function formatStorageFromLimits(lim) {
  if (!lim) return null
  const bytes = lim.storage_limit_bytes
  if (bytes != null && Number.isFinite(Number(bytes))) {
    return storageLabelFromBytes(bytes)
  }
  const mb = lim.storage_mb
  if (mb != null && Number.isFinite(Number(mb))) {
    const gb = Number(mb) / 1024
    if (gb >= 1) return `${gb % 1 === 0 ? Math.round(gb) : Math.round(gb * 10) / 10} GB Sənəd Yaddaşı`
    return `${Math.round(Number(mb))} MB Sənəd Yaddaşı`
  }
  if (lim.storage_mb === null && lim.storage_limit_bytes === null) return 'Limitsiz Sənəd Yaddaşı'
  return null
}

export function planLimitFeatureLines(p) {
  const items = Array.isArray(p?.items)
    ? p.items.map((x) => String(x || '').trim()).filter(Boolean)
    : []
  if (items.length) return items

  const lim = p?.limits
  if (!lim) return []

  const id = String(p?.id || '').toLowerCase()
  const lines = []
  if (lim.students == null) lines.push('Limitsiz tələbə')
  else lines.push(`${Math.max(0, Math.round(Number(lim.students)))} tələbə`)

  const storage = formatStorageFromLimits(lim)
  if (storage) lines.push(storage)
  else if (lim.storage_mb == null && lim.storage_limit_bytes === null) lines.push('Limitsiz Sənəd Yaddaşı')

  if (lim.sms_monthly == null) lines.push('Limitsiz SMS / ay')
  else if (id === 'premium' || id === 'business') lines.push('200 SMS / Əlavə balans imkanı')
  else lines.push(`${Math.max(0, Math.round(Number(lim.sms_monthly)))} SMS / ay`)

  return lines
}

/** Qısa başlıq (kartın üstündəki birinci sətir). */
export function planLimitsHeadline(p) {
  const lines = planLimitFeatureLines(p)
  if (lines.length) return lines.join(' · ')
  return 'Limitlər mövcud paketə uyğun tətbiq olunur.'
}

const PLAN_DESCRIPTIONS = {
  basic:
    'Platformanı sınaqdan keçirmək və kiçik qrupları idarə etmək üçün tamamilə ödənişsiz əsas paket.',
  pro: 'Fərdi repetitorlar və kiçik qrupları olan təlimçilər üçün ən populyar seçim.',
  growth: 'Tədris fəaliyyətini böyüdən və daha çox qrupu olan peşəkar müəllimlər üçün.',
  premium: 'Böyük auditoriyası olan kurslar və limitsiz tələbə bazası idarə etmək istəyənlər üçün tam paket.',
}

/** Kartda tam izah (bütün paketlər). */
export function planDetailLines(p) {
  const id = String(p?.id || '').toLowerCase()
  const normId = id === 'business' ? 'premium' : id
  const features = planLimitFeatureLines(p)
  const limitsText = features.length ? features.join(', ') : null
  const price = Number(p?.price_azn)
  const isPaid = normId !== 'basic' && Number.isFinite(price) && price > 0
  const desc = PLAN_DESCRIPTIONS[normId]

  if (normId === 'basic') {
    return [
      desc || 'Ödənişsiz əsas paket.',
      limitsText ? `${limitsText} mövcuddur.` : 'Limitlər pulsuz paketə uyğun tətbiq olunur.',
      'Limitlərə çatdıqda daha geniş paket seçməyiniz tələb olunacaq.',
    ]
  }

  if (isPaid) {
    const lines = [
      desc || 'Aylıq və ya illik ödənişlə aktiv abunədir; ödəniş təsdiqlənəndən sonra limitlər dərhal tətbiq olunur.',
    ]
    if (limitsText) lines.push(`Paketə daxildir: ${limitsText}.`)
    if (normId === 'premium') {
      lines.push('Limitsiz tələbə — SMS limiti 200/ay (əlavə balans alına bilər).')
    } else {
      lines.push('Limitlərə çatdıqda paketi yüksəldin və ya əlavə SMS/yaddaş alın.')
    }
    return lines
  }

  return limitsText ? [`${limitsText}.`] : ['Limitlər mövcud paketə uyğun tətbiq olunur.']
}
