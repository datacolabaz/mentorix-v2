/** Paket kartlarında limit sətirləri (API: items və ya limits). */

import { planTitleOrSlug } from './subscriptionPlanGuards'
import { normalizePlanId } from './subscriptionPlanMarketing'

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

function documentLineFromLimits(lim, opts) {
  if (!lim) return null
  const docs = lim.documents ?? lim.document_limit
  if (docs == null) return pt(opts, 'limits.documentsUnlimited', {}, 'Limitsiz sənəd')
  return pt(opts, 'limits.documents', { count: fmtNum(docs, opts) }, `${fmtNum(docs, opts)} sənəd`)
}

/** Marketing cards: cloud storage (recording_storage) instead of document counts. */
function cloudStorageLineFromPlan(p, lim, planId, opts) {
  const id = String(planId || '').toLowerCase()
  const normId = id === 'business' ? 'premium' : id
  const rec = resolveRecordingFromPlan(p, lim, normId)
  const gb = Number(formatRecordingStorageGb(rec.storageBytes, opts))
  if (Number.isFinite(gb) && gb > 0) {
    return pt(opts, 'limits.cloudStorageGb', { size: gb }, `${gb} GB Bulud Yaddaşı`)
  }
  return documentLineFromLimits(lim, opts)
}

function storageLabelFromBytes(bytes, opts) {
  const b = Number(bytes)
  if (!Number.isFinite(b) || b <= 0) return null
  if (b === 5 * 1024 * 1024) return pt(opts, 'limits.storage5mb', {}, '5 MB Sənəd Yaddaşı')
  if (b === 256 * 1024 * 1024) return pt(opts, 'limits.storage256mb', {}, '256 MB Sənəd Yaddaşı')
  if (b === 1024 * 1024 * 1024) return pt(opts, 'limits.storage1gb', {}, '1 GB Sənəd Yaddaşı')
  if (b === 2048 * 1024 * 1024) return pt(opts, 'limits.storage2gb', {}, '2 GB Sənəd Yaddaşı')
  if (b < 1024 * 1024) {
    const kb = Math.max(1, Math.round(b / 1024))
    return pt(opts, 'limits.storageKb', { size: kb }, `${kb} KB Sənəd Yaddaşı`)
  }
  const mb = b / (1024 * 1024)
  if (mb >= 1024) {
    const gb = mb / 1024
    const size = gb % 1 === 0 ? Math.round(gb) : Math.round(gb * 10) / 10
    return pt(opts, 'limits.storageGb', { size }, `${size} GB Sənəd Yaddaşı`)
  }
  const size = mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10
  return pt(opts, 'limits.storageMb', { size }, `${size} MB Sənəd Yaddaşı`)
}

function formatStorageFromLimits(lim, opts) {
  if (!lim) return null
  const bytes = lim.storage_limit_bytes
  if (bytes != null && Number.isFinite(Number(bytes))) {
    return storageLabelFromBytes(bytes, opts)
  }
  const mb = lim.storage_mb
  if (mb != null && Number.isFinite(Number(mb))) {
    const gb = Number(mb) / 1024
    if (gb >= 1) {
      const size = gb % 1 === 0 ? Math.round(gb) : Math.round(gb * 10) / 10
      return pt(opts, 'limits.storageGb', { size }, `${size} GB Sənəd Yaddaşı`)
    }
    return pt(opts, 'limits.storageMb', { size: Math.round(Number(mb)) }, `${Math.round(Number(mb))} MB Sənəd Yaddaşı`)
  }
  if (lim.storage_mb === null && lim.storage_limit_bytes === null) {
    return pt(opts, 'limits.storageUnlimited', {}, 'Limitsiz Sənəd Yaddaşı')
  }
  return null
}

function smsEffectiveLineForCurrentUser({ billing, planId, baseSms }, opts) {
  const effective = billing?.limits?.sms_monthly
  if (effective == null || effective === '') return null
  const e = Math.max(0, Math.round(Number(effective)))
  if (!Number.isFinite(e)) return null
  const billingBase = billing?.limits?.sms_monthly_plan
  const base = billingBase == null || billingBase === '' ? baseSms : Number(billingBase)
  const b = Math.max(0, Math.round(Number(base || baseSms || 0)))
  const extra = Math.max(0, e - b)
  if (!extra) {
    return pt(opts, 'limits.smsMonthly', { count: fmtNum(e, opts) }, `${fmtNum(e, opts)} SMS / ay`)
  }
  return pt(
    opts,
    'limits.smsEffective',
    { effective: fmtNum(e, opts), base: fmtNum(b, opts), extra: fmtNum(extra, opts) },
    `${fmtNum(e, opts)} SMS / ay (baza ${fmtNum(b, opts)} + əlavə ${fmtNum(extra, opts)})`,
  )
}

const CONTENT_LIMIT_RE = /\b(imtahan|tapşırıq|sənəd|экзамен|задани|документ)\b/i

/** Fallback when API/plan row omits recording columns (matches migration 196 + config/plans). */
const RECORDING_FALLBACK_BY_PLAN = {
  basic: {
    recording_hours_monthly: 0,
    recording_storage_bytes: 0,
    recording_retention_days: 0,
    recording_max_duration_sec: 0,
    recording_max_quality: null,
  },
  pro: {
    recording_hours_monthly: 5,
    recording_storage_bytes: 5 * 1024 * 1024 * 1024,
    recording_retention_days: 30,
    recording_max_duration_sec: 7200,
    recording_max_quality: '720p',
  },
  growth: {
    recording_hours_monthly: 20,
    recording_storage_bytes: 20 * 1024 * 1024 * 1024,
    recording_retention_days: 90,
    recording_max_duration_sec: 7200,
    recording_max_quality: '720p',
  },
  premium: {
    recording_hours_monthly: 50,
    recording_storage_bytes: 50 * 1024 * 1024 * 1024,
    recording_retention_days: 180,
    recording_max_duration_sec: 10800,
    recording_max_quality: '1080p',
  },
}

function liveParticipantFallback(planId) {
  const id = String(planId || '').toLowerCase()
  if (id === 'premium' || id === 'business') return null
  if (id === 'growth') return 50
  if (id === 'pro') return 20
  return 5
}

function resolveRecordingFromPlan(p, lim, planId) {
  const nested = p?.recording_limits || {}
  const fb = RECORDING_FALLBACK_BY_PLAN[planId] || RECORDING_FALLBACK_BY_PLAN.basic
  const hours =
    lim?.recording_hours_monthly ?? nested.hours_monthly ?? fb.recording_hours_monthly
  const storage =
    lim?.recording_storage_bytes ?? nested.storage_bytes ?? fb.recording_storage_bytes
  const retention =
    lim?.recording_retention_days ?? nested.retention_days ?? fb.recording_retention_days
  const maxDur =
    lim?.recording_max_duration_sec ?? nested.max_duration_sec ?? fb.recording_max_duration_sec
  const quality =
    lim?.recording_max_quality ?? nested.max_quality ?? fb.recording_max_quality
  return {
    hours: hours == null ? 0 : Number(hours),
    storageBytes: storage == null ? 0 : Number(storage),
    retentionDays: retention == null ? 0 : Number(retention),
    maxDurationSec: maxDur == null ? 0 : Number(maxDur),
    quality: quality == null || String(quality).trim() === '' ? null : String(quality).trim(),
  }
}

function formatRecordingStorageGb(bytes, opts) {
  const b = Number(bytes)
  if (!Number.isFinite(b) || b <= 0) return '0'
  const gb = b / (1024 * 1024 * 1024)
  return gb % 1 === 0 ? String(Math.round(gb)) : String(Math.round(gb * 10) / 10)
}

function formatRecordingMaxMinutes(sec, opts) {
  const s = Math.max(0, Math.round(Number(sec) || 0))
  return fmtNum(Math.round(s / 60), opts)
}

/** Live lesson COUNT is unlimited on all packages; participants + recording are plan-gated. */
function liveAndRecordingLinesFromPlan(p, lim, planId = '', opts = {}) {
  const id = String(planId || '').toLowerCase()
  const lines = []
  lines.push(pt(opts, 'limits.liveLessonsUnlimited', {}, 'Limitsiz canlı dərslər'))

  const raw = lim?.live_participants !== undefined ? lim.live_participants : liveParticipantFallback(id)
  if (raw == null) {
    lines.push(pt(opts, 'limits.liveParticipantsUnlimited', {}, 'Limitsiz iştirakçı'))
  } else {
    lines.push(
      pt(
        opts,
        'limits.liveParticipantsOnly',
        { count: fmtNum(raw, opts) },
        `${fmtNum(raw, opts)} iştirakçı / canlı dərs`,
      ),
    )
  }

  const rec = resolveRecordingFromPlan(p, lim, id === 'business' ? 'premium' : id)
  if (!rec.hours || rec.hours <= 0 || !rec.storageBytes || rec.storageBytes <= 0) {
    lines.push(pt(opts, 'limits.recordingNone', {}, 'Dərs yazısı yoxdur (SADƏ)'))
    return lines
  }

  const hoursLabel = Number.isInteger(rec.hours) ? String(rec.hours) : String(rec.hours)
  const storageGb = formatRecordingStorageGb(rec.storageBytes, opts)
  const maxMin = formatRecordingMaxMinutes(rec.maxDurationSec, opts)
  const quality = rec.quality || '720p'
  lines.push(
    pt(
      opts,
      'limits.recordingQuota',
      {
        hours: hoursLabel,
        storage: storageGb,
        retention: fmtNum(rec.retentionDays, opts),
        maxMin,
        quality,
      },
      `Yazı: ${hoursLabel} saat/ay · ${storageGb} GB · ${fmtNum(rec.retentionDays, opts)} gün saxlama · max ${maxMin} dəq · ${quality}`,
    ),
  )
  return lines
}

function monthlyContentLimitLines(lim, planId = '', opts = {}) {
  if (!lim) return []
  const isTrial = String(planId).toLowerCase() === 'basic'
  const lines = []
  if (lim.exams_monthly == null) {
    lines.push(
      isTrial || String(planId).toLowerCase() === 'premium'
        ? pt(opts, 'limits.examsUnlimited', {}, 'Limitsiz imtahan')
        : pt(opts, 'limits.examsUnlimitedMonthly', {}, 'Limitsiz imtahan / ay'),
    )
  } else if (isTrial) {
    lines.push(
      pt(opts, 'limits.examsTrial', { count: fmtNum(lim.exams_monthly, opts) }, `${fmtNum(lim.exams_monthly, opts)} imtahan`),
    )
  } else {
    lines.push(
      pt(
        opts,
        'limits.examsMonthly',
        { count: fmtNum(lim.exams_monthly, opts) },
        `${fmtNum(lim.exams_monthly, opts)} imtahan / ay`,
      ),
    )
  }
  if (lim.homeworks_monthly == null) {
    lines.push(
      isTrial || String(planId).toLowerCase() === 'premium'
        ? pt(opts, 'limits.homeworksUnlimited', {}, 'Limitsiz tapşırıq')
        : pt(opts, 'limits.homeworksUnlimitedMonthly', {}, 'Limitsiz tapşırıq / ay'),
    )
  } else if (isTrial) {
    lines.push(
      pt(
        opts,
        'limits.homeworksTrial',
        { count: fmtNum(lim.homeworks_monthly, opts) },
        `${fmtNum(lim.homeworks_monthly, opts)} tapşırıq`,
      ),
    )
  } else {
    lines.push(
      pt(
        opts,
        'limits.homeworksMonthly',
        { count: fmtNum(lim.homeworks_monthly, opts) },
        `${fmtNum(lim.homeworks_monthly, opts)} tapşırıq / ay`,
      ),
    )
  }
  return lines
}

/** Landing qiymət kartları üçün limit sətirləri (istifadəçi spec). */
export function planPricingLimitLines(p, opts = {}) {
  const lim = p?.limits
  if (!lim) return []
  const id = String(p?.id || p?.slug || '').toLowerCase()
  const isTrial = id === 'basic'
  const lines = []

  if (lim.students == null) lines.push(pt(opts, 'limits.studentsUnlimited', {}, 'Limitsiz tələbə'))
  else lines.push(pt(opts, 'limits.students', { count: fmtNum(lim.students, opts) }, `${fmtNum(lim.students, opts)} tələbə`))

  const cloudLine = cloudStorageLineFromPlan(p, lim, id, opts)
  if (cloudLine) lines.push(cloudLine)

  if (lim.sms_monthly == null) lines.push(pt(opts, 'limits.smsUnlimited', {}, 'Limitsiz SMS / ay'))
  else if (isTrial) {
    lines.push(pt(opts, 'limits.smsTrial', { count: fmtNum(lim.sms_monthly, opts) }, `${fmtNum(lim.sms_monthly, opts)} SMS`))
  } else {
    lines.push(
      pt(opts, 'limits.smsMonthly', { count: fmtNum(lim.sms_monthly, opts) }, `${fmtNum(lim.sms_monthly, opts)} SMS / ay`),
    )
  }

  lines.push(...monthlyContentLimitLines(lim, id, opts))
  lines.push(...liveAndRecordingLinesFromPlan(p, lim, id, opts))
  return lines
}

export function planLimitFeatureLines(p, opts = {}) {
  const billing = opts?.billing || null
  const isCurrent = Boolean(opts?.isCurrent)
  const planId = String(p?.id || p?.slug || '').toLowerCase()
  const items = Array.isArray(p?.items)
    ? p.items.map((x) => String(x || '').trim()).filter(Boolean)
    : []
  const contentLimits = monthlyContentLimitLines(p?.limits, planId, opts)
  const liveRecLines = liveAndRecordingLinesFromPlan(p, p?.limits, planId, opts)
  if (items.length) {
    const LIVE_OR_RECORD_RE = /\b(canlı|live|запись|record|yazı|iştirakçı|участник)\b/i
    const base = items.filter(
      (line) => !CONTENT_LIMIT_RE.test(String(line)) && !LIVE_OR_RECORD_RE.test(String(line)),
    )
    return [...base, ...contentLimits, ...liveRecLines]
  }

  const lim = p?.limits
  if (!lim) return []

  const id = planId
  const lines = []
  if (lim.students == null) lines.push(pt(opts, 'limits.studentsUnlimited', {}, 'Limitsiz tələbə'))
  else lines.push(pt(opts, 'limits.students', { count: fmtNum(lim.students, opts) }, `${fmtNum(lim.students, opts)} tələbə`))

  const docLine = documentLineFromLimits(lim, opts)
  if (docLine) lines.push(docLine)
  else {
    const storage = formatStorageFromLimits(lim, opts)
    if (storage) lines.push(storage)
    else if (lim.storage_mb == null && lim.storage_limit_bytes === null) {
      lines.push(pt(opts, 'limits.documentsUnlimited', {}, 'Limitsiz sənəd'))
    }
  }

  if (lim.sms_monthly == null) lines.push(pt(opts, 'limits.smsUnlimited', {}, 'Limitsiz SMS / ay'))
  else if (id === 'premium' || id === 'business') {
    const baseSms = Math.max(0, Math.round(Number(lim.sms_monthly)))
    if (isCurrent) {
      const effectiveLine = smsEffectiveLineForCurrentUser({ billing, planId: id, baseSms }, opts)
      if (effectiveLine) lines.push(effectiveLine)
      else {
        lines.push(
          pt(
            opts,
            'limits.smsPremiumCurrent',
            { count: fmtNum(baseSms, opts) },
            `${fmtNum(baseSms, opts)} SMS / ay (əlavə balans alına bilər)`,
          ),
        )
      }
    } else {
      lines.push(
        pt(
          opts,
          'limits.smsPremiumOther',
          { count: fmtNum(baseSms, opts) },
          `${fmtNum(baseSms, opts)} SMS / Əlavə balans imkanı`,
        ),
      )
    }
  } else {
    lines.push(
      pt(opts, 'limits.smsMonthly', { count: fmtNum(lim.sms_monthly, opts) }, `${fmtNum(lim.sms_monthly, opts)} SMS / ay`),
    )
  }

  lines.push(...monthlyContentLimitLines(lim, id, opts))
  lines.push(...liveAndRecordingLinesFromPlan(p, lim, id, opts))
  return lines
}

function mapFeatureForPlan(p, opts = {}) {
  const id = String(p?.id || '')
    .trim()
    .toLowerCase()
  const normId = id === 'business' ? 'premium' : id
  const fallbacks = {
    basic: '📍 Xəritədə görünür',
    pro: '📍 Xəritədə görünür',
    growth: '⭐ Axtarışda önə çıxır',
    premium: '🔥 Axtarışda həmişə ən yuxarıda (TOP)',
  }
  return pt(opts, `map.${normId}`, {}, fallbacks[normId] || fallbacks.basic)
}

/** Qısa başlıq (kartın üstündəki birinci sətir). */
export function planLimitsHeadline(p, opts = {}) {
  const lines = planLimitFeatureLines(p, opts)
  const mapLine = mapFeatureForPlan(p, opts)
  const merged = lines.length ? [...lines, mapLine] : [mapLine]
  return merged.join(' · ')
}

function planDescription(p, opts = {}) {
  const custom = p?.plan_description ?? p?.description
  if (custom != null && String(custom).trim() !== '') return String(custom).trim()
  const id = normalizePlanId(p)
  const title = opts.planTitle || planTitleOrSlug(p, id)
  if (id === 'basic') {
    return pt(opts, 'desc.basic', {}, '21 günlük pulsuz sınaq — platformanı risksiz sınayın.')
  }
  if (id === 'pro') {
    return pt(opts, 'desc.pro', { title }, `Kiçik və orta qruplar üçün ən populyar ${title} paket.`)
  }
  if (id === 'growth') {
    return pt(opts, 'desc.growth', { title }, `${title} paket — böyüyən tədris biznesi və ətraflı hesabatlar.`)
  }
  if (id === 'premium') {
    return pt(opts, 'desc.premium', { title }, `${title} paket — limitsiz tələbə, 50 GB bulud yaddaşı və prioritet dəstək.`)
  }
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
  const desc = planDescription(p, opts)
  const mapLine = mapFeatureForPlan(p, opts)

  if (normId === 'basic') {
    return [
      desc || pt(opts, 'detail.basic.trial', {}, '21 günlük pulsuz sınaq paketi.'),
      mapLine,
      limitsText
        ? pt(opts, 'detail.basic.limitsPeriod', { limits: limitsText }, `Sınaq müddətində: ${limitsText}.`)
        : pt(opts, 'detail.basic.limitsFallback', {}, 'Limitlər Başlanğıc paketinə uyğun tətbiq olunur.'),
      pt(opts, 'detail.basic.noExtraSms', {}, 'Əlavə SMS və yaddaş alına bilməz — limit dolanda Standart və ya daha yüksək paket seçin.'),
      pt(opts, 'detail.basic.noRenew', {}, 'Başlanğıc paketi yenilənmir; 21 gün bitəndən sonra ödənişli paket tələb olunur.'),
      pt(opts, 'detail.basic.oneTrialPerIp', {}, 'Hər cihazdan (IP) yalnız bir dəfə pulsuz sınaq verilir.'),
    ]
  }

  if (isPaid) {
    const lines = [
      desc ||
        pt(
          opts,
          'detail.paid.subscription',
          {},
          'Aylıq və ya illik ödənişlə aktiv abunədir; ödəniş təsdiqlənəndən sonra limitlər dərhal tətbiq olunur.',
        ),
      mapLine,
    ]
    if (limitsText) {
      lines.push(pt(opts, 'detail.paid.includes', { limits: limitsText }, `Paketə daxildir: ${limitsText}.`))
    }
    if (normId === 'premium') {
      if (isCurrent) {
        const baseSms = Number(p?.limits?.sms_monthly ?? 200)
        const effectiveLine = smsEffectiveLineForCurrentUser({ billing, planId: normId, baseSms }, opts)
        if (effectiveLine) {
          const smsPart = effectiveLine.replace(/ SMS \/ ay.*$/i, '').replace(/ \/ мес\..*$/i, '')
          lines.push(
            pt(opts, 'detail.paid.premiumSmsEffective', { sms: smsPart }, `Limitsiz tələbə — SMS limiti ${smsPart}.`),
          )
        } else {
          lines.push(
            pt(opts, 'detail.paid.premiumSmsDefault', {}, 'Limitsiz tələbə — SMS limiti 200/ay (əlavə balans alına bilər).'),
          )
        }
      } else {
        lines.push(
          pt(opts, 'detail.paid.premiumSmsDefault', {}, 'Limitsiz tələbə — SMS limiti 200/ay (əlavə balans alına bilər).'),
        )
      }
    } else {
      lines.push(
        pt(opts, 'detail.paid.upgradeHint', {}, 'Limitlərə çatdıqda paketi yüksəldin və ya əlavə SMS/yaddaş alın.'),
      )
    }
    return lines
  }

  return limitsText
    ? [pt(opts, 'detail.fallback.limits', { limits: limitsText }, `${limitsText}.`)]
    : [pt(opts, 'detail.fallback.default', {}, 'Limitlər mövcud paketə uyğun tətbiq olunur.')]
}
