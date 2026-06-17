/** Paket kartlarında limit sətirləri (API: items və ya limits). */

import { planTitleOrSlug } from './subscriptionPlanGuards'
import { normalizePlanId } from './subscriptionPlanMarketing'

function fmtAzNum(n) {
  const v = Math.max(0, Math.round(Number(n) || 0))
  return new Intl.NumberFormat('az-AZ').format(v)
}

function documentLineFromLimits(lim) {
  if (!lim) return null
  const docs = lim.documents ?? lim.document_limit
  if (docs == null) return 'Limitsiz sənəd'
  return `${fmtAzNum(docs)} sənəd`
}

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

function smsEffectiveLineForCurrentUser({ billing, planId, baseSms }) {
  const effective = billing?.limits?.sms_monthly
  if (effective == null || effective === '') return null
  const e = Math.max(0, Math.round(Number(effective)))
  if (!Number.isFinite(e)) return null
  // If we have base plan SMS in billing payload, show breakdown.
  const billingBase = billing?.limits?.sms_monthly_plan
  const base = billingBase == null || billingBase === '' ? baseSms : Number(billingBase)
  const b = Math.max(0, Math.round(Number(base || baseSms || 0)))
  const extra = Math.max(0, e - b)
  if (!extra) return `${e} SMS / ay`
  // Keep it short so it doesn't overflow cards.
  return `${e} SMS / ay (baza ${b} + əlavə ${extra})`
}

const CONTENT_LIMIT_RE = /\b(imtahan|tapşırıq|sənəd)\b/i

function monthlyContentLimitLines(lim, planId = '') {
  if (!lim) return []
  const isTrial = String(planId).toLowerCase() === 'basic'
  const lines = []
  if (lim.exams_monthly == null) lines.push(isTrial || String(planId).toLowerCase() === 'premium' ? 'Limitsiz imtahan' : 'Limitsiz imtahan / ay')
  else if (isTrial) lines.push(`${fmtAzNum(lim.exams_monthly)} imtahan`)
  else lines.push(`${fmtAzNum(lim.exams_monthly)} imtahan / ay`)
  if (lim.homeworks_monthly == null) lines.push(isTrial || String(planId).toLowerCase() === 'premium' ? 'Limitsiz tapşırıq' : 'Limitsiz tapşırıq / ay')
  else if (isTrial) lines.push(`${fmtAzNum(lim.homeworks_monthly)} tapşırıq`)
  else lines.push(`${fmtAzNum(lim.homeworks_monthly)} tapşırıq / ay`)
  return lines
}

/** Landing qiymət kartları üçün limit sətirləri (istifadəçi spec). */
export function planPricingLimitLines(p) {
  const lim = p?.limits
  if (!lim) return []
  const id = String(p?.id || p?.slug || '').toLowerCase()
  const isTrial = id === 'basic'
  const lines = []

  if (lim.students == null) lines.push('Limitsiz tələbə')
  else lines.push(`${fmtAzNum(lim.students)} tələbə`)

  const docLine = documentLineFromLimits(lim)
  if (docLine) lines.push(docLine)
  else {
    const storage = formatStorageFromLimits(lim)
    if (storage) lines.push(storage.replace(/Sənəd Yaddaşı/gi, 'sənəd').replace(/yaddaş/gi, 'sənəd'))
    else if (lim.storage_mb == null && lim.storage_limit_bytes == null) lines.push('Limitsiz sənəd')
  }

  if (lim.sms_monthly == null) lines.push('Limitsiz SMS / ay')
  else if (isTrial) lines.push(`${fmtAzNum(lim.sms_monthly)} SMS`)
  else lines.push(`${fmtAzNum(lim.sms_monthly)} SMS / ay`)

  lines.push(...monthlyContentLimitLines(lim, id))
  return lines
}

export function planLimitFeatureLines(p, opts = {}) {
  const billing = opts?.billing || null
  const isCurrent = Boolean(opts?.isCurrent)
  const planId = String(p?.id || p?.slug || '').toLowerCase()
  const items = Array.isArray(p?.items)
    ? p.items.map((x) => String(x || '').trim()).filter(Boolean)
    : []
  const contentLimits = monthlyContentLimitLines(p?.limits, planId)
  if (items.length) {
    const base = items.filter((line) => !CONTENT_LIMIT_RE.test(String(line)))
    return [...base, ...contentLimits]
  }

  const lim = p?.limits
  if (!lim) return []

  const id = planId
  const lines = []
  if (lim.students == null) lines.push('Limitsiz tələbə')
  else lines.push(`${fmtAzNum(lim.students)} tələbə`)

  const docLine = documentLineFromLimits(lim)
  if (docLine) lines.push(docLine)
  else {
    const storage = formatStorageFromLimits(lim)
    if (storage) lines.push(storage)
    else if (lim.storage_mb == null && lim.storage_limit_bytes === null) lines.push('Limitsiz sənəd')
  }

  if (lim.sms_monthly == null) lines.push('Limitsiz SMS / ay')
  else if (id === 'premium' || id === 'business') {
    const baseSms = Math.max(0, Math.round(Number(lim.sms_monthly)))
    if (isCurrent) {
      const effectiveLine = smsEffectiveLineForCurrentUser({ billing, planId: id, baseSms })
      if (effectiveLine) lines.push(effectiveLine)
      else lines.push(`${baseSms} SMS / ay (əlavə balans alına bilər)`)
    } else {
      // For other plans (not current user's active one), show base plan.
      lines.push(`${baseSms} SMS / Əlavə balans imkanı`)
    }
  }
  else lines.push(`${fmtAzNum(lim.sms_monthly)} SMS / ay`)

  lines.push(...monthlyContentLimitLines(lim, id))
  return lines
}

const MAP_FEATURE_LINES = {
  basic: '📍 Xəritədə görünür',
  pro: '📍 Xəritədə görünür',
  growth: '⭐ Axtarışda önə çıxır',
  premium: '🔥 Axtarışda həmişə ən yuxarıda (TOP)',
}

function mapFeatureForPlan(p) {
  const id = String(p?.id || '')
    .trim()
    .toLowerCase()
  const normId = id === 'business' ? 'premium' : id
  return MAP_FEATURE_LINES[normId] || MAP_FEATURE_LINES.basic
}

/** Qısa başlıq (kartın üstündəki birinci sətir). */
export function planLimitsHeadline(p, opts = {}) {
  const lines = planLimitFeatureLines(p, opts)
  const mapLine = mapFeatureForPlan(p)
  const merged = lines.length ? [...lines, mapLine] : [mapLine]
  return merged.join(' · ')
}

function planDescription(p) {
  const custom = p?.plan_description ?? p?.description
  if (custom != null && String(custom).trim() !== '') return String(custom).trim()
  const id = normalizePlanId(p)
  const title = planTitleOrSlug(p, id)
  if (id === 'basic') return '14 günlük pulsuz sınaq — platformanı risksiz sınayın.'
  if (id === 'pro') return `Kiçik və orta qruplar üçün ən populyar ${title} paket.`
  if (id === 'growth') return `${title} paket — böyüyən tədris biznesi və ətraflı hesabatlar.`
  if (id === 'premium') return `${title} paket — limitsiz tələbə/sənəd və prioritet dəstək.`
  return null
}

/** Kartda tam izah (bütün paketlər). */
export function planDetailLines(p, opts = {}) {
  const billing = opts?.billing || null
  const isCurrent = Boolean(opts?.isCurrent)
  const id = String(p?.id || '').toLowerCase()
  const normId = id === 'business' ? 'premium' : id
  const features = planLimitFeatureLines(p, { ...opts, billing, isCurrent })
  const limitsText = features.length ? features.join(', ') : null
  const price = Number(p?.price_azn)
  const isPaid = normId !== 'basic' && Number.isFinite(price) && price > 0
  const desc = planDescription(p)

  const mapLine = mapFeatureForPlan(p)

  if (normId === 'basic') {
    return [
      desc || '14 günlük pulsuz sınaq paketi.',
      mapLine,
      limitsText ? `Sınaq müddətində: ${limitsText}.` : 'Limitlər Başlanğıc paketinə uyğun tətbiq olunur.',
      'Əlavə SMS və yaddaş alına bilməz — limit dolanda Standart və ya daha yüksək paket seçin.',
      'Başlanğıc paketi yenilənmir; 14 gün bitəndən sonra ödənişli paket tələb olunur.',
      'Hər cihazdan (IP) yalnız bir dəfə pulsuz sınaq verilir.',
    ]
  }

  if (isPaid) {
    const lines = [
      desc || 'Aylıq və ya illik ödənişlə aktiv abunədir; ödəniş təsdiqlənəndən sonra limitlər dərhal tətbiq olunur.',
      mapLine,
    ]
    if (limitsText) lines.push(`Paketə daxildir: ${limitsText}.`)
    if (normId === 'premium') {
      if (isCurrent) {
        const baseSms = Number(p?.limits?.sms_monthly ?? 200) // fallback
        const effectiveLine = smsEffectiveLineForCurrentUser({ billing, planId: normId, baseSms })
        if (effectiveLine) {
          lines.push(`Limitsiz tələbə — SMS limiti ${effectiveLine.replace(' SMS / ay', '')}.`)
        } else {
          lines.push('Limitsiz tələbə — SMS limiti 200/ay (əlavə balans alına bilər).')
        }
      } else {
        lines.push('Limitsiz tələbə — SMS limiti 200/ay (əlavə balans alına bilər).')
      }
    } else {
      lines.push('Limitlərə çatdıqda paketi yüksəldin və ya əlavə SMS/yaddaş alın.')
    }
    return lines
  }

  return limitsText ? [`${limitsText}.`] : ['Limitlər mövcud paketə uyğun tətbiq olunur.']
}
