import api from './api'
import { withEnrollmentQuery } from './studentGroupQuery'

/** Bir rol üçün bir sorğu: server rolu və sahibliyi özü müəyyən edir (başqasının ID-si göndərilmir). */
export const fetchDashboardSummary = (enrollmentId = '') =>
  api.get(withEnrollmentQuery('/dashboard/summary', enrollmentId))

export const fetchAdminOperations = () => api.get('/dashboard/admin/operations')

/** Server yalnız active/pending_setup qeydiyyatla filtrləyir; təsdiq gözləyən qrup seçiləndə 404 olmasın deyə ümumi xülasə. */
const SUMMARY_SCOPE_STATUSES = new Set(['active', 'pending_setup'])
export function summaryEnrollmentId(enrollment) {
  if (!enrollment?.enrollment_id) return ''
  const status = String(enrollment.status || 'active').trim().toLowerCase()
  return SUMMARY_SCOPE_STATUSES.has(status) ? String(enrollment.enrollment_id) : ''
}

/** Bənd ikonları (dekorativ; mətn həmişə yanındadır). */
export const ITEM_ICONS = {
  security_events: '🛡️',
  partner_applications: '🤝',
  failed_email_deliveries: '✉️',
  failed_background_jobs: '⚙️',
  commission_actions: '💸',
  unread_submissions: '📥',
  pending_grading: '📝',
  overdue_assignments: '⏰',
  assessment_expiry: '⌛',
  unviewed_materials: '📚',
  join_requests: '🙋',
  new_assessments: '🧪',
  new_assignments: '📝',
  new_materials: '📚',
  upcoming_deadlines: '📅',
  released_results: '🏁',
  teacher_feedback: '💬',
}

const SEVERITY_TONE = { critical: 'red', warning: 'yellow' }

/**
 * Status = ikon + mətn + rəng (rəng tək siqnal deyil).
 * Admin bəndlərində server `severity` verir; digərlərində bəndin `tone`-u.
 * @returns {{ key: 'unavailable'|'none'|'urgent'|'review'|'new'|'ready'|'info', icon: string, tone: string }}
 */
export function itemStatus(item) {
  if (!item || item.available === false) return { key: 'unavailable', icon: '?', tone: 'gray' }
  if (!item.count) return { key: 'none', icon: '✓', tone: 'gray' }
  const tone = item.severity ? SEVERITY_TONE[item.severity] || 'blue' : item.tone || 'blue'
  if (tone === 'red') return { key: 'urgent', icon: '!', tone }
  if (tone === 'yellow') return { key: 'review', icon: '⏳', tone }
  if (tone === 'green') return { key: 'ready', icon: '✓', tone }
  if (tone === 'gray') return { key: 'info', icon: '○', tone }
  return { key: 'new', icon: '●', tone: 'blue' }
}

export const JOIN_STATUS = {
  pending: { icon: '⏳', tone: 'yellow' },
  approved: { icon: '✓', tone: 'green' },
  rejected: { icon: '✕', tone: 'red' },
}

/** Diqqət tələb edən bəndlərin sayı (mövcud və sayı > 0). */
export function attentionCount(items = []) {
  return items.filter((i) => i && i.available !== false && i.count > 0).length
}

/** «₼12.50» — qəpikdən. */
export function formatCents(cents) {
  const n = Math.round(Number(cents) || 0) / 100
  return `₼${n.toFixed(2)}`
}

/**
 * Bəndin alt sətri üçün i18n açarı və parametrləri; tarix sahələri ayrıca qaytarılır (formatDateTime ilə yazılır).
 * @returns {{ key: string, values: object, dateIso?: string, dateKey?: string } | null}
 */
export function itemDetail(item) {
  if (!item || item.available === false) return null
  const d = item.detail || {}
  const base = `dashboardSummary.detail.${item.key}`
  switch (item.key) {
    case 'security_events':
      return d.auth_failures_24h != null ? { key: base, values: { count: d.auth_failures_24h } } : null
    case 'partner_applications':
      return d.oldest_at ? { key: base, values: {}, dateIso: d.oldest_at } : null
    case 'failed_email_deliveries':
      return d.last_7d != null ? { key: base, values: { count: d.last_7d } } : null
    case 'failed_background_jobs':
      return { key: base, values: { days: d.window_days ?? 7 } }
    case 'commission_actions':
      return {
        key: base,
        values: {
          payouts: d.pending_payouts ?? 0,
          amount: formatCents(d.pending_payout_cents),
          commissions: d.pending_commissions ?? 0,
        },
      }
    case 'pending_grading':
      return { key: base, values: { assignments: d.assignments ?? 0, exams: d.exams ?? 0 } }
    case 'overdue_assignments':
      return item.count ? { key: base, values: { count: d.assignments ?? 0 } } : null
    case 'assessment_expiry':
      return { key: base, values: { auto: d.auto_submitted ?? 0, empty: d.expired_no_answers ?? 0 } }
    case 'unviewed_materials':
      return item.count ? { key: base, values: { materials: d.materials ?? 0, overdue: d.overdue ?? 0 } } : null
    case 'upcoming_deadlines':
      return d.next_at ? { key: base, values: {}, dateIso: d.next_at } : null
    case 'released_results':
      return d.latest_at ? { key: base, values: {}, dateIso: d.latest_at } : null
    case 'teacher_feedback':
      return item.count ? { key: base, values: { graded: d.graded ?? 0, returned: d.returned ?? 0 } } : null
    default:
      return null
  }
}

export const ACTIVITY_BUCKET_ICONS = {
  submissions: '📥',
  exams_completed: '🏁',
  exams_started: '▶',
  material_views: '👁',
  downloads: '⬇',
  expired: '⌛',
}
