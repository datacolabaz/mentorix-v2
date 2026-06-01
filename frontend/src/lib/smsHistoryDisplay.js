const AZ_MONTHS = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avqust',
  'sentyabr',
  'oktyabr',
  'noyabr',
  'dekabr',
]

export const SMS_STATUS_UI = {
  sent: { icon: '✓', label: 'Göndərildi', badge: 'paid' },
  logged: { icon: '📝', label: 'Yalnız qeyd', badge: 'due' },
  whatsapp: { icon: '💬', label: 'WhatsApp', badge: 'due' },
  failed: { icon: '✕', label: 'Uğursuz', badge: 'danger' },
  scheduled: { icon: '📅', label: 'Planlaşdırılıb', badge: 'due' },
  pending: { icon: '🕒', label: 'Gözləyir', badge: 'due' },
}

export function smsStatusLabel(status) {
  const st = SMS_STATUS_UI[String(status || '').toLowerCase()]
  return st ? `${st.icon} ${st.label}` : String(status || '—')
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

export function formatSmsDateTime(iso, now = new Date()) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const today = startOfDay(now)
  const that = startOfDay(d)
  const diffDays = Math.round((today - that) / 86400000)
  const time = d.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 0) return `Bu gün • ${time}`
  if (diffDays === 1) return `Dünən • ${time}`
  const day = d.getDate()
  const month = AZ_MONTHS[d.getMonth()] || ''
  const year = d.getFullYear()
  return `${day} ${month} ${year} • ${time}`
}

export function formatSmsDateTimeLong(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const day = d.getDate()
  const month = AZ_MONTHS[d.getMonth()] || ''
  const year = d.getFullYear()
  const time = d.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })
  return `${day} ${month} ${year}, ${time}`
}

export function formatRelativeAz(iso, now = new Date()) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const ms = Math.max(0, now.getTime() - d.getTime())
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s} saniyə əvvəl`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} dəqiqə əvvəl`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h} saat əvvəl`
  const days = Math.floor(h / 24)
  if (days < 14) return `${days} gün əvvəl`
  return formatSmsDateTimeLong(iso)
}

export function humanizeSmsFailure(reason) {
  const r = String(reason || '').trim()
  if (!r) return 'Səbəb qeyd olunmayıb'
  const low = r.toLowerCase()
  if (/limit|quota|dolub/i.test(low)) return 'SMS limiti bitib'
  if (/phone|nömrə|msisdn|invalid.*number/i.test(low)) return 'Nömrə yanlışdır və ya format uyğun deyil'
  if (/credential|login|password|auth/i.test(low)) return 'SMS provayder giriş məlumatları səhvdir'
  if (/provider|responsecode|smxml|sendsms/i.test(low)) return 'SMS provayder xətası'
  if (/http|network|fetch|timeout/i.test(low)) return 'Şəbəkə və ya server xətası'
  return r
}

export function countSmsByStatus(rows, status) {
  return (rows || []).filter((x) => String(x.status || '').toLowerCase() === status).length
}

export function currentMonthLabelAz(now = new Date()) {
  const month = AZ_MONTHS[now.getMonth()] || ''
  return month ? month.charAt(0).toUpperCase() + month.slice(1) : ''
}

export function exportSmsHistoryCsv(rows, filename = 'sms-tarixcesi.csv') {
  const esc = (v) => {
    const s = String(v ?? '').replace(/"/g, '""')
    return `"${s}"`
  }
  const lines = [
    ['Tarix', 'Status', 'Növ', 'Tələbə', 'Telefon', 'Simvol', 'Hissə', 'Səbəb', 'Mesaj'].map(esc).join(','),
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
