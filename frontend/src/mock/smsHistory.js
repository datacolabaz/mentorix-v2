const DAY_MS = 24 * 60 * 60 * 1000

export const smsHistoryMock = [
  {
    id: 'sms_1',
    type: 'payment_reminder',
    students: ['Əli Məmmədov', 'Arzu Əliyeva'],
    status: 'sent', // sent | failed | scheduled
    message: 'Ödəniş vaxtınız yaxınlaşır. Zəhmət olmasa ay sonunadək ödənişi tamamlayın.',
    createdAt: '2026-04-26T12:45:00',
  },
  {
    id: 'sms_2',
    type: 'payment_reminder',
    students: ['Aynisan Nebiyeva'],
    status: 'failed',
    message: 'Ödəniş xatırlatma: bu ay üçün ödənişiniz gecikir. Sualınız olsa yazın.',
    createdAt: '2026-04-25T18:10:00',
  },
  {
    id: 'sms_3',
    type: 'payment_reminder',
    students: ['Nərgiz Hüseynova', 'Kamal Qasımov', 'Leyla Məmmədli'],
    status: 'scheduled',
    message: 'Salam! Ödənişiniz sabah üçün planlaşdırılıb. Xahiş edirik gecikdirməyin.',
    createdAt: '2026-04-27T09:00:00',
  },
]

function safeDate(v) {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatAgoShort(iso, now = new Date()) {
  const d = safeDate(iso)
  if (!d) return '—'
  const diff = now.getTime() - d.getTime()
  const abs = Math.abs(diff)
  if (abs < 60 * 1000) return 'indi'
  if (abs < 60 * 60 * 1000) return `${Math.round(abs / (60 * 1000))} dəq əvvəl`
  if (abs < DAY_MS) return `${Math.round(abs / (60 * 60 * 1000))} saat əvvəl`
  return `${Math.round(abs / DAY_MS)} gün əvvəl`
}

export function isToday(iso, now = new Date()) {
  const d = safeDate(iso)
  if (!d) return false
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export function isThisWeek(iso, now = new Date()) {
  const d = safeDate(iso)
  if (!d) return false
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  // week starts Monday
  const day = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - day)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return d >= start && d < end
}

export function isThisMonth(iso, now = new Date()) {
  const d = safeDate(iso)
  if (!d) return false
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

export function getLastSmsForStudentName(fullName, list = smsHistoryMock) {
  const name = String(fullName || '').trim()
  if (!name) return null
  const hit = [...list]
    .filter((x) => Array.isArray(x.students) && x.students.includes(name))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  return hit || null
}

export function getSmsInsights(list = smsHistoryMock, now = new Date()) {
  const today = list.filter((x) => isToday(x.createdAt, now) && x.status === 'sent')
  const failed = list.filter((x) => x.status === 'failed')
  // approximate unique student count for today
  const uniq = new Set(today.flatMap((x) => x.students || []))
  return {
    sentTodayCount: uniq.size,
    failedCount: failed.reduce((acc, x) => acc + (Array.isArray(x.students) ? x.students.length : 0), 0),
  }
}

