import { formatNamedDate, formatNumericDate } from './azMonths.js'

/**
 * Engagement UI mətnləri və status təyinatları.
 * Rəng heç vaxt tək siqnal deyil: hər statusun ikonu və mətni var.
 */

export const MATERIAL_KIND = {
  pdf: { icon: '📄', label: 'PDF' },
  video: { icon: '🎬', label: 'Video' },
  link: { icon: '🔗', label: 'Link' },
  document: { icon: '📝', label: 'Sənəd' },
  presentation: { icon: '📽️', label: 'Təqdimat' },
  text: { icon: '📃', label: 'Mətn dərsi' },
  image: { icon: '🖼️', label: 'Şəkil' },
  file: { icon: '📎', label: 'Fayl' },
}

/**
 * tone: green | yellow | red | gray | blue
 * Tətbiqin mövzusu <html> üzərindəki `theme-dark` sinfidir (OS yox), ona görə `dark:` əvəzinə `[.theme-dark_&]:`.
 */
export const TONE_CLASSES = {
  green: 'bg-emerald-500/15 text-emerald-700 [.theme-dark_&]:text-emerald-300 border-emerald-500/30',
  yellow: 'bg-amber-500/15 text-amber-800 [.theme-dark_&]:text-amber-300 border-amber-500/30',
  red: 'bg-red-500/15 text-red-700 [.theme-dark_&]:text-red-300 border-red-500/30',
  gray: 'bg-slate-500/10 text-slate-600 [.theme-dark_&]:text-slate-300 border-slate-500/25',
  blue: 'bg-sky-500/15 text-sky-700 [.theme-dark_&]:text-sky-300 border-sky-500/30',
}

/** Kart sətirlərindəki rəqəm/mətn rəngi (fon olmadan). */
export const TONE_TEXT = {
  green: 'text-emerald-700 [.theme-dark_&]:text-emerald-300',
  yellow: 'text-amber-800 [.theme-dark_&]:text-amber-300',
  red: 'text-red-700 [.theme-dark_&]:text-red-300',
  gray: 'text-slate-600 [.theme-dark_&]:text-slate-300',
  blue: 'text-sky-700 [.theme-dark_&]:text-sky-300',
}

export const BAR_CLASSES = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
  gray: 'bg-slate-400',
}

export const SUBTLE_BG = 'bg-black/10 [.theme-dark_&]:bg-white/10'
export const HOVER_BG = 'hover:bg-black/[0.03] [.theme-dark_&]:hover:bg-white/[0.04]'

const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1'
export const CTA_LINK = `rounded text-xs font-semibold text-primary hover:underline ${FOCUS_RING}`
export const CTA_BUTTON = `rounded-lg border border-primary/40 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-60 ${FOCUS_RING}`

export const MATERIAL_STATUS = {
  completed: { label: 'Baxıb', icon: '✓', tone: 'green' },
  in_progress: { label: 'Baxmağa başlayıb', icon: '▶', tone: 'yellow' },
  opened: { label: 'Açıb, baxmayıb', icon: '◐', tone: 'yellow' },
  not_opened: { label: 'Açmayıb', icon: '○', tone: 'gray' },
  overdue: { label: 'Vaxtı keçib, baxmayıb', icon: '!', tone: 'red' },
}

export const ASSIGNMENT_STATUS = {
  graded: { label: 'Qiymətləndirilib', icon: '✓', tone: 'green' },
  submitted: { label: 'Yoxlama gözləyir', icon: '⏳', tone: 'yellow' },
  returned: { label: 'Düzəlişə qaytarılıb', icon: '↺', tone: 'yellow' },
  started: { label: 'Başlayıb, təqdim etməyib', icon: '✎', tone: 'yellow' },
  opened: { label: 'Açıb, təqdim etməyib', icon: '◐', tone: 'yellow' },
  overdue: { label: 'Vaxtı keçib', icon: '!', tone: 'red' },
  not_opened: { label: 'Açmayıb', icon: '○', tone: 'gray' },
}

export function materialStatusKey(s) {
  return s?.overdue ? 'overdue' : s?.status || 'not_opened'
}

export const MATERIAL_FILTERS = [
  { id: '', label: 'Hamısı' },
  { id: 'viewed', label: 'Baxıb' },
  { id: 'not_viewed', label: 'Baxmayıb' },
  { id: 'overdue', label: 'Vaxtı keçib' },
]

export const ASSIGNMENT_FILTERS = [
  { id: '', label: 'Hamısı' },
  { id: 'submitted', label: 'Təqdim edib' },
  { id: 'not_submitted', label: 'Təqdim etməyib' },
  { id: 'waiting_grading', label: 'Yoxlama gözləyir' },
  { id: 'graded', label: 'Qiymətləndirilib' },
  { id: 'returned', label: 'Düzəlişə qaytarılıb' },
  { id: 'overdue', label: 'Vaxtı keçib' },
  { id: 'not_opened', label: 'Açmayıb' },
]

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toLocaleUpperCase('az')
}

/** «5 dəq əvvəl», «dünən 14:20», «12.09.2026». */
export function relativeTime(iso, now = new Date()) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const diffMin = Math.round((now - d) / 60000)
  if (diffMin < 1) return 'indicə'
  if (diffMin < 60) return `${diffMin} dəq əvvəl`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `${diffH} saat əvvəl`
  const diffD = Math.round(diffH / 24)
  if (diffD === 1) return 'dünən'
  if (diffD < 7) return `${diffD} gün əvvəl`
  return formatNumericDate(d)
}

/** Son 24 saatdakı fəaliyyət «yeni» sayılır (mavi). */
export function isRecent(iso, now = new Date()) {
  if (!iso) return false
  const d = new Date(iso)
  return !Number.isNaN(d.getTime()) && now - d < 24 * 3600 * 1000
}

/** «28 sentyabr» (cari il) və ya «28 sentyabr 2027». Intl ay adlarına güvənmirik (bəzi mühitlərdə «M09» çıxır). */
export function formatDue(value, now = new Date()) {
  if (!value) return null
  const raw = String(value)
  const d = new Date(raw.length <= 10 ? `${raw}T12:00:00Z` : raw)
  if (Number.isNaN(d.getTime())) return null
  const text = formatNamedDate(d, 'az')
  const year = ` ${now.getFullYear()}`
  return text.endsWith(year) ? text.slice(0, -year.length) : text
}

export function progressTone(pct) {
  if (pct >= 80) return 'green'
  if (pct >= 40) return 'yellow'
  return pct > 0 ? 'red' : 'gray'
}
