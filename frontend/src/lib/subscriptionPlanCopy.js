/** Paket kartlarında limit sətirləri (API: items və ya limits). */

import { planTitleOrSlug } from './subscriptionPlanGuards'
import { normalizePlanId } from './subscriptionPlanMarketing'

function pickT(opts) {
  return typeof opts?.t === 'function' ? opts.t : null
}

function numLocale(opts) {
  const lang = opts?.lang || opts?.i18n?.language || 'az'
  return String(lang).toLowerCase().startsWith('ru') ? 'ru-RU' : 'az-AZ'
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

function liveClassLineFromLimits(lim, planId = '', opts = {}) {
  const id = String(planId).toLowerCase()
  const fallback =
    id === 'premium' || id === 'business'
      ? null
      : id === 'growth'
        ? 50
        : id === 'pro'
          ? 20
          : 5
  const raw = lim?.live_participants ?? fallback
  if (raw == null) {
    return pt(opts, 'limits.liveUnlimited', {}, 'Canlı dərs — Limitsiz iştirakçı · Record: ✓ (local)')
  }
  return pt(
    opts,
    'limits.liveParticipants',
    { count: fmtNum(raw, opts) },
    `Canlı dərs — ${fmtNum(raw, opts)} iştirakçı · Record: ✓ (local)`,
  )
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

  const docLine = documentLineFromLimits(lim, opts)
  if (docLine) lines.push(docLine)
  else {
    const storage = formatStorageFromLimits(lim, opts)
    if (storage) {
      const t = pickT(opts)
      if (t) lines.push(storage)
      else lines.push(storage.replace(/Sənəd Yaddaşı/gi, 'sənəd').replace(/yaddaş/gi, 'sənəd'))
    } else if (lim.storage_mb == null && lim.storage_limit_bytes == null) {
      lines.push(pt(opts, 'limits.documentsUnlimited', {}, 'Limitsiz sənəd'))
    }
  }

  if (lim.sms_monthly == null) lines.push(pt(opts, 'limits.smsUnlimited', {}, 'Limitsiz SMS / ay'))
  else if (isTrial) {
    lines.push(pt(opts, 'limits.smsTrial', { count: fmtNum(lim.sms_monthly, opts) }, `${fmtNum(lim.sms_monthly, opts)} SMS`))
  } else {
    lines.push(
      pt(opts, 'limits.smsMonthly', { count: fmtNum(lim.sms_monthly, opts) }, `${fmtNum(lim.sms_monthly, opts)} SMS / ay`),
    )
  }

  lines.push(...monthlyContentLimitLines(lim, id, opts))
  lines.push(liveClassLineFromLimits(lim, id, opts))
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
  if (items.length) {
    const base = items.filter((line) => !CONTENT_LIMIT_RE.test(String(line)))
    return [...base, ...contentLimits]
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
  lines.push(liveClassLineFromLimits(lim, id, opts))
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
    return pt(opts, 'desc.basic', {}, '14 günlük pulsuz sınaq — platformanı risksiz sınayın.')
  }
  if (id === 'pro') {
    return pt(opts, 'desc.pro', { title }, `Kiçik və orta qruplar üçün ən populyar ${title} paket.`)
  }
  if (id === 'growth') {
    return pt(opts, 'desc.growth', { title }, `${title} paket — böyüyən tədris biznesi və ətraflı hesabatlar.`)
  }
  if (id === 'premium') {
    return pt(opts, 'desc.premium', { title }, `${title} paket — limitsiz tələbə/sənəd və prioritet dəstək.`)
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
      desc || pt(opts, 'detail.basic.trial', {}, '14 günlük pulsuz sınaq paketi.'),
      mapLine,
      limitsText
        ? pt(opts, 'detail.basic.limitsPeriod', { limits: limitsText }, `Sınaq müddətində: ${limitsText}.`)
        : pt(opts, 'detail.basic.limitsFallback', {}, 'Limitlər Başlanğıc paketinə uyğun tətbiq olunur.'),
      pt(opts, 'detail.basic.noExtraSms', {}, 'Əlavə SMS və yaddaş alına bilməz — limit dolanda Standart və ya daha yüksək paket seçin.'),
      pt(opts, 'detail.basic.noRenew', {}, 'Başlanğıc paketi yenilənmir; 14 gün bitəndən sonra ödənişli paket tələb olunur.'),
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
