import i18n from '../i18n'

export const SMS_STATUS_UI = {
  sent: { icon: '✓', badge: 'paid' },
  logged: { icon: '📝', badge: 'due' },
  whatsapp: { icon: '💬', badge: 'due' },
  failed: { icon: '✕', badge: 'danger' },
  scheduled: { icon: '📅', badge: 'due' },
  pending: { icon: '🕒', badge: 'due' },
}

function statusLabel(status) {
  const key = String(status || '').toLowerCase()
  return i18n.t(`notifications.smsStatus.${key}`, { defaultValue: String(status || '—') })
}

export function smsStatusLabel(status) {
  const st = SMS_STATUS_UI[String(status || '').toLowerCase()]
  return st ? `${st.icon} ${statusLabel(status)}` : String(status || '—')
}

export function smsMessageLength(message) {
  return String(message || '').length
}

export function smsPartCount(message) {
  const len = smsMessageLength(message)
  if (!len) return 0
  if (len <= 160) return 1
  return Math.ceil(len / 153)
}

export function formatPhoneDisplay(phone) {
  const d = String(phone || '').replace(/\D/g, '')
  if (!d) return '—'
  if (d.startsWith('994') && d.length >= 12) {
    return `+994 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`.trim()
  }
  if (d.startsWith('0') && d.length === 10) {
    return `+994 ${d.slice(1, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`.trim()
  }
  return phone ? String(phone) : `+${d}`
}

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function monthName(monthIndex) {
  return i18n.t(`notifications.months.${monthIndex}`, { defaultValue: '' })
}

export function formatSmsDateTime(iso, now = new Date()) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const today = startOfDay(now)
  const that = startOfDay(d)
  const diffDays = Math.round((today - that) / 86400000)
  const locale = i18n.language === 'ru' ? 'ru-RU' : 'az-AZ'
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 0) return i18n.t('notifications.dateToday', { time })
  if (diffDays === 1) return i18n.t('notifications.dateYesterday', { time })
  const day = d.getDate()
  const month = monthName(d.getMonth())
  const year = d.getFullYear()
  return `${day} ${month} ${year} • ${time}`
}

export function formatSmsDateTimeLong(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const locale = i18n.language === 'ru' ? 'ru-RU' : 'az-AZ'
  const day = d.getDate()
  const month = monthName(d.getMonth())
  const year = d.getFullYear()
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  return `${day} ${month} ${year}, ${time}`
}

export function formatRelativeAz(iso, now = new Date()) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const ms = Math.max(0, now.getTime() - d.getTime())
  const s = Math.floor(ms / 1000)
  if (s < 60) return i18n.t('notifications.relative.seconds', { count: s })
  const m = Math.floor(s / 60)
  if (m < 60) return i18n.t('notifications.relative.minutes', { count: m })
  const h = Math.floor(m / 60)
  if (h < 48) return i18n.t('notifications.relative.hours', { count: h })
  const days = Math.floor(h / 24)
  if (days < 14) return i18n.t('notifications.relative.days', { count: days })
  return formatSmsDateTimeLong(iso)
}

export function humanizeSmsFailure(reason) {
  const r = String(reason || '').trim()
  if (!r) return i18n.t('notifications.smsFailure.unknown')
  const low = r.toLowerCase()
  if (/limit|quota|dolub/i.test(low)) return i18n.t('notifications.smsFailure.quota')
  if (/phone|nömrə|msisdn|invalid.*number/i.test(low)) return i18n.t('notifications.smsFailure.phone')
  if (/credential|login|password|auth/i.test(low)) return i18n.t('notifications.smsFailure.credentials')
  if (/provider|responsecode|smxml|sendsms/i.test(low)) return i18n.t('notifications.smsFailure.provider')
  if (/http|network|fetch|timeout/i.test(low)) return i18n.t('notifications.smsFailure.network')
  return r
}

export function countSmsByStatus(rows, status) {
  return (rows || []).filter((x) => String(x.status || '').toLowerCase() === status).length
}

export function currentMonthLabelAz(now = new Date()) {
  return monthName(now.getMonth())
}

export function exportSmsHistoryCsv(rows, filename = 'sms-tarixcesi.csv') {
  const esc = (v) => {
    const s = String(v ?? '').replace(/"/g, '""')
    return `"${s}"`
  }
  const h = i18n.getResourceBundle(i18n.language, 'translation')?.notifications?.csvHeaders || {}
  const lines = [
    [
      h.date || 'Tarix',
      h.status || 'Status',
      h.type || 'Növ',
      h.student || 'Tələbə',
      h.phone || 'Telefon',
      h.chars || 'Simvol',
      h.parts || 'Hissə',
      h.reason || 'Səbəb',
      h.message || 'Mesaj',
    ]
      .map(esc)
      .join(','),
  ]
  for (const x of rows || []) {
    lines.push(
      [
        x.createdAt || x.created_at || '',
        x.status || '',
        x.type || '',
        x.student_name || '',
        x.phone || '',
        smsMessageLength(x.message),
        smsPartCount(x.message),
        x.reason || '',
        x.message || '',
      ]
        .map(esc)
        .join(','),
    )
  }
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
