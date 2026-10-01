/** Paket kartlarında limit sətirləri (API: items və ya limits). */

import { resolveAiPlanLimits } from '../constants/aiPlanLimits'
import { planTitleOrSlug } from './subscriptionPlanGuards'
import { normalizePlanId } from './subscriptionPlanMarketing'

/** Matches AI quota lines so static/API feature lists do not duplicate them. */
export const AI_LIMIT_LINE_RE =
  /\b(AI\s*sual|AI\s*question|ИИ-вопрос|AI\s*Tapşırıq|AI\s*ilə\s*yoxlan|AI\s*qiymət|AI\s*grading|AI-checked|AI\s*assignment\s*review|ИИ-оцен|ИИ-проверк|проверенн\S*\s+ИИ)/i

/** Live lessons run on the teacher's own Google Meet / Zoom / other link; Mentorix only schedules them. */
const LIVE_LESSON_LINE_FALLBACK = 'Google Meet və Zoom linkləri ilə limitsiz canlı dərs planlama'

function pickT(opts) {
  return typeof opts?.t === 'function' ? opts.t : null
}

function numLocale(opts) {
  const lang = opts?.lang || opts?.i18n?.language || 'az'
  const l = String(lang).toLowerCase()
  if (l.startsWith('ru')) return 'ru-RU'
  if (l.startsWith('en')) return 'en-GB'
  return 'az-AZ'
}

function fmtNum(n, opts) {
  const v = Math.max(0, Math.round(Number(n) || 0))
  return new Intl.NumberFormat(numLocale(opts)).format(v)
}

function pt(opts, key, params, fallback) {
  const t = pickT(opts)
  if (!t) return fallback
  const val = t(`planCopy.${key}`, { defaultValue: fallback, ...params })
  return val === `planCopy.${key}` ? fallback : val
}

function storageSize(bytes) {
  const b = Number(bytes)
  if (!Number.isFinite(b) || b <= 0) return null
  const gb = b / (1024 * 1024 * 1024)
  if (gb >= 1) return { value: gb % 1 === 0 ? Math.round(gb) : Math.round(gb * 10) / 10, unit: 'GB' }
  const mb = b / (1024 * 1024)
  return { value: mb >= 10 ? Math.round(mb) : Math.max(1, Math.round(mb * 10) / 10), unit: 'MB' }
}

/** Cloud storage line from limits.storage_limit_bytes (null = unlimited, legacy plans only). */
function cloudStorageLine(lim, opts) {
  if (!lim) return null
  if (lim.storage_limit_bytes === null && (lim.storage_mb === null || lim.storage_mb === undefined)) {
    return pt(opts, 'limits.cloudStorageUnlimited', {}, 'Limitsiz bulud yaddaşı')
  }
  const bytes = lim.storage_limit_bytes ?? (lim.storage_mb != null ? Number(lim.storage_mb) * 1024 * 1024 : null)
  const size = storageSize(bytes)
  if (!size) return null
  return size.unit === 'GB'
    ? pt(opts, 'limits.cloudStorageGb', { size: size.value }, `${size.value} GB bulud yaddaşı`)
    : pt(opts, 'limits.cloudStorageMb', { size: size.value }, `${size.value} MB bulud yaddaşı`)
}

/** Compare-table cell for cloud storage. */
export function cloudStorageCompareValue(p, opts = {}) {
  const lim = p?.limits || {}
  if (lim.storage_limit_bytes === null && (lim.storage_mb === null || lim.storage_mb === undefined)) {
    return pt(opts, 'limits.unlimitedShort', {}, 'Limitsiz')
  }
  const size = storageSize(lim.storage_limit_bytes ?? (lim.storage_mb != null ? Number(lim.storage_mb) * 1024 * 1024 : null))
  if (!size) return null
  return `${size.value} ${size.unit}`
}

export function liveLessonPlanLine(opts = {}) {
  return pt(opts, 'limits.liveLessonLinks', {}, LIVE_LESSON_LINE_FALLBACK)
}

const CONTENT_LIMIT_RE = /\b(imtahan|tapşırıq|sənəd|экзамен|задани|документ)\b/i
const LIVE_LINE_RE = /\b(canlı|live|живы|запись|record|yazı|iştirakçı|участник|participant)\b/i

function studentLine(lim, opts) {
  if (lim.students == null) return pt(opts, 'limits.studentsUnlimited', {}, 'Limitsiz tələbə')
  return pt(opts, 'limits.students', { count: fmtNum(lim.students, opts) }, `${fmtNum(lim.students, opts)} tələbə`)
}

function monthlyContentLimitLines(lim, planId = '', opts = {}) {
  if (!lim) return []
  const id = String(planId).toLowerCase()
  const isTrial = id === 'basic'
  const lines = []
  if (lim.exams_monthly == null) {
    lines.push(pt(opts, 'limits.examsUnlimited', {}, 'Limitsiz imtahan'))
  } else if (isTrial) {
    lines.push(pt(opts, 'limits.examsTrial', { count: fmtNum(lim.exams_monthly, opts) }, `${fmtNum(lim.exams_monthly, opts)} imtahan`))
  } else {
    lines.push(pt(opts, 'limits.examsMonthly', { count: fmtNum(lim.exams_monthly, opts) }, `${fmtNum(lim.exams_monthly, opts)} imtahan / ay`))
  }
  if (lim.homeworks_monthly == null) {
    lines.push(pt(opts, 'limits.homeworksUnlimited', {}, 'Limitsiz tapşırıq'))
  } else if (isTrial) {
    lines.push(
      pt(opts, 'limits.homeworksTrial', { count: fmtNum(lim.homeworks_monthly, opts) }, `${fmtNum(lim.homeworks_monthly, opts)} tapşırıq`),
    )
  } else {
    lines.push(
      pt(opts, 'limits.homeworksMonthly', { count: fmtNum(lim.homeworks_monthly, opts) }, `${fmtNum(lim.homeworks_monthly, opts)} tapşırıq / ay`),
    )
  }
  lines.push(...planAiLimitLines({ limits: lim, id: planId, slug: planId }, opts))
  return lines
}

/** AI question + AI-checked open-answer lines for any package card (always resolved via shared quotas). */
export function planAiLimitLines(p, opts = {}) {
  const { questions, gradings, isTrial } = resolveAiPlanLimits(p)
  const q = fmtNum(questions, opts)
  const g = fmtNum(gradings, opts)
  return [
    isTrial
      ? pt(opts, 'limits.aiQuestionsTrial', { count: q }, `${q} AI sual`)
      : pt(opts, 'limits.aiQuestionsMonthly', { count: q }, `${q} AI sual / ay`),
    isTrial
      ? pt(opts, 'limits.aiGradingsTrial', { count: g }, `${g} AI ilə yoxlanılan açıq-cavab işi`)
      : pt(opts, 'limits.aiGradingsMonthly', { count: g }, `${g} AI ilə yoxlanılan açıq-cavab işi / ay`),
  ]
}

/** Insert AI quota lines into a static bullet list without duplicates. */
export function ensureAiLimitLinesInBullets(bullets, p, opts = {}) {
  const list = Array.isArray(bullets) ? bullets.map((x) => String(x || '').trim()).filter(Boolean) : []
  const ai = planAiLimitLines(p, opts)
  const withoutAi = list.filter((line) => !AI_LIMIT_LINE_RE.test(line))
  let insertAt = -1
  for (let i = 0; i < withoutAi.length; i += 1) {
    if (/\b(tapşırıq|assignment|задани|imtahan|exam|экзамен)\b/i.test(withoutAi[i])) insertAt = i
  }
  if (insertAt >= 0) {
    return [...withoutAi.slice(0, insertAt + 1), ...ai, ...withoutAi.slice(insertAt + 1)]
  }
  const liveIdx = withoutAi.findIndex((line) => /\b(canlı|live|живы)\b/i.test(line))
  if (liveIdx >= 0) {
    return [...withoutAi.slice(0, liveIdx), ...ai, ...withoutAi.slice(liveIdx)]
  }
  return [...withoutAi, ...ai]
}

/** Pricing card limit lines (students, storage, content, AI, live lesson links). */
export function planPricingLimitLines(p, opts = {}) {
  const lim = p?.limits
  if (!lim) return []
  const id = normalizePlanId(p)
  const lines = [studentLine(lim, opts)]
  const storage = cloudStorageLine(lim, opts)
  if (storage) lines.push(storage)
  lines.push(...monthlyContentLimitLines(lim, id, opts))
  lines.push(liveLessonPlanLine(opts))
  return lines
}

export function planLimitFeatureLines(p, opts = {}) {
  const planId = normalizePlanId(p)
  const items = Array.isArray(p?.items) ? p.items.map((x) => String(x || '').trim()).filter(Boolean) : []
  if (items.length) {
    const base = items.filter(
      (line) => !CONTENT_LIMIT_RE.test(line) && !LIVE_LINE_RE.test(line) && !AI_LIMIT_LINE_RE.test(line) && !/\bSMS\b/i.test(line),
    )
    return [...base, ...monthlyContentLimitLines(p?.limits, planId, opts), liveLessonPlanLine(opts)]
  }
  return planPricingLimitLines(p, opts)
}

function mapFeatureForPlan(p, opts = {}) {
  const id = normalizePlanId(p)
  const fallbacks = {
    basic: '📍 Xəritədə görünür',
    pro: '📍 Xəritədə görünür',
    growth: '⭐ Axtarışda önə çıxır',
    premium: '🔥 Axtarışda həmişə ən yuxarıda (TOP)',
  }
  return pt(opts, `map.${id}`, {}, fallbacks[id] || fallbacks.basic)
}

/** Qısa başlıq (kartın üstündəki birinci sətir). */
export function planLimitsHeadline(p, opts = {}) {
  const lines = planLimitFeatureLines(p, opts)
  const mapLine = mapFeatureForPlan(p, opts)
  return (lines.length ? [...lines, mapLine] : [mapLine]).join(' · ')
}

function planDescription(p, opts = {}) {
  const custom = p?.plan_description ?? p?.description
  if (custom != null && String(custom).trim() !== '') return String(custom).trim()
  const id = normalizePlanId(p)
  const title = opts.planTitle || planTitleOrSlug(p, id)
  if (id === 'basic') return pt(opts, 'desc.basic', {}, 'Mentorix-in əsas imkanlarını 21 gün ödənişsiz yoxlayın.')
  if (id === 'pro') return pt(opts, 'desc.pro', { title }, `${title} — köhnə paket, mövcud abunəçilər üçün saxlanılır.`)
  if (id === 'growth') return pt(opts, 'desc.growth', { title }, 'Böyüyən qrupları idarə edən müəllimlər üçün.')
  if (id === 'premium') return pt(opts, 'desc.premium', { title }, 'Aktiv müəllimlər və daha böyük tədris qrupları üçün.')
  return null
}

/** Kartda tam izah (bütün paketlər). */
export function planDetailLines(p, opts = {}) {
  const id = normalizePlanId(p)
  const features = planLimitFeatureLines(p, opts)
  const limitsText = features.length ? features.join(', ') : null
  const price = Number(p?.price_azn)
  const isPaid = id !== 'basic' && Number.isFinite(price) && price > 0
  const desc = planDescription(p, opts)
  const mapLine = mapFeatureForPlan(p, opts)

  if (id === 'basic') {
    return [
      desc,
      mapLine,
      limitsText
        ? pt(opts, 'detail.basic.limitsPeriod', { limits: limitsText }, `Sınaq müddətində: ${limitsText}.`)
        : pt(opts, 'detail.basic.limitsFallback', {}, 'Limitlər sınaq paketinə uyğun tətbiq olunur.'),
      pt(opts, 'detail.basic.noAutoCharge', {}, 'Sınaq bitdikdə avtomatik ödəniş tutulmur — davam etmək üçün paketi özünüz seçirsiniz.'),
      pt(opts, 'detail.basic.noRenew', {}, 'Sınaq paketi yenilənmir; 21 gün bitəndən sonra ödənişli paket tələb olunur.'),
      pt(opts, 'detail.basic.oneTrialPerIp', {}, 'Hər cihazdan (IP) yalnız bir dəfə pulsuz sınaq verilir.'),
    ].filter(Boolean)
  }

  if (isPaid) {
    const lines = [
      desc ||
        pt(opts, 'detail.paid.subscription', {}, 'Aylıq və ya illik ödənişlə aktiv abunədir; ödəniş təsdiqlənəndən sonra limitlər dərhal tətbiq olunur.'),
      mapLine,
    ]
    if (limitsText) lines.push(pt(opts, 'detail.paid.includes', { limits: limitsText }, `Paketə daxildir: ${limitsText}.`))
    lines.push(pt(opts, 'detail.paid.upgradeHint', {}, 'Limitlərə çatdıqda paketi yüksəldin və ya əlavə yaddaş alın.'))
    return lines
  }

  return limitsText
    ? [pt(opts, 'detail.fallback.limits', { limits: limitsText }, `${limitsText}.`)]
    : [pt(opts, 'detail.fallback.default', {}, 'Limitlər mövcud paketə uyğun tətbiq olunur.')]
}
