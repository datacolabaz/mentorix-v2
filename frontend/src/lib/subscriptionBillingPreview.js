/**
 * Aylıq ankor borcu — backend subscriptionBilling.js ilə eyni məntiqi saxlayın (önizləmə üçün).
 */

function pad2(n) {
  return n < 10 ? `0${n}` : String(n)
}

function roundMoney(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

function parseYmdParts(ymd) {
  if (!ymd) return null
  const m = String(ymd).trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) }
}

function compareYmd(aStr, bStr) {
  if (aStr < bStr) return -1
  if (aStr > bStr) return 1
  return 0
}

function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function billingYmdForCalendarMonth(year, month, anchorDay) {
  const last = lastDayOfMonth(year, month)
  const day = Math.min(anchorDay, last)
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function listBillingDueDatesUpTo(anchorYmd, untilYmd) {
  const ap = parseYmdParts(anchorYmd)
  if (!ap || !untilYmd || !/^\d{4}-\d{2}-\d{2}$/.test(String(untilYmd).slice(0, 10))) return []
  const until = String(untilYmd).slice(0, 10)
  const anchorDay = ap.d
  const out = []
  let y = ap.y
  let mo = ap.mo
  for (;;) {
    const cur = billingYmdForCalendarMonth(y, mo, anchorDay)
    if (compareYmd(cur, until) > 0) break
    out.push(cur)
    if (mo === 12) {
      y += 1
      mo = 1
    } else {
      mo += 1
    }
  }
  return out
}

function countSubscriptionBillingMonths(anchorYmd, untilYmd) {
  return listBillingDueDatesUpTo(anchorYmd, untilYmd).length
}

export function anchorToYmd(v) {
  if (v == null) return null
  const s = String(v)
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

export function computeMonthlyBalanceState({ monthly_fee, anchor_ymd, today_ymd, total_paid }) {
  const fee = Number(monthly_fee)
  const paid = roundMoney(Number(total_paid) || 0)
  const anchorYmd = anchor_ymd ? String(anchor_ymd).slice(0, 10) : null
  const todayYmd = today_ymd ? String(today_ymd).slice(0, 10) : null

  if (anchorYmd && todayYmd && compareYmd(anchorYmd, todayYmd) > 0) {
    return {
      accrued_total: 0,
      total_payments: paid,
      net_balance: 0,
      pending_debt: 0,
      subscription_months: 0,
      billing_anchor_future: true,
    }
  }

  let monthsCount = 0
  let accrued = 0
  if (anchorYmd && Number.isFinite(fee) && fee > 0 && todayYmd) {
    monthsCount = countSubscriptionBillingMonths(anchorYmd, todayYmd)
    accrued = roundMoney(monthsCount * fee)
  }

  const netBalance = roundMoney(paid - accrued)
  const owe = roundMoney(Math.max(0, accrued - paid))

  return {
    accrued_total: accrued,
    total_payments: paid,
    net_balance: netBalance,
    pending_debt: owe,
    subscription_months: monthsCount,
    billing_anchor_future: false,
  }
}
