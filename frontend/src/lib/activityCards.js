/**
 * Müəllim aktivlik kartları və hesabatları üçün təmiz (React-sız) köməkçilər.
 * Kart sətirlərinin `filter` dəyəri backend-in CARD_FILTER_PARITY xəritəsi ilə eynidir:
 * kartdakı rəqəm = hesabatda həmin filtrlə görünən sətir sayı.
 */

export const ACTIVITY_TYPES = Object.freeze(['material', 'assignment', 'exam'])

export const REPORT_FILTER_IDS = Object.freeze({
  material: ['viewed', 'not_viewed', 'in_progress', 'completed', 'downloaded', 'not_downloaded', 'overdue'],
  assignment: [
    'viewed',
    'not_viewed',
    'started',
    'in_progress',
    'submitted',
    'not_submitted',
    'waiting_grading',
    'graded',
    'returned',
    'late',
    'overdue',
  ],
  exam: [
    'viewed',
    'not_viewed',
    'started',
    'not_started',
    'in_progress',
    'inactive',
    'completed',
    'submitted',
    'not_submitted',
    'expired',
    'pending_manual_grading',
  ],
})

export const STATUS_IDS = Object.freeze({
  material: ['completed', 'in_progress', 'opened', 'not_opened'],
  assignment: ['graded', 'submitted', 'returned', 'started', 'opened', 'overdue', 'not_opened'],
  exam: [
    'completed',
    'pending_manual_grading',
    'expired_auto_submitted',
    'in_progress',
    'inactive',
    'expired_no_answers',
    'viewed',
    'not_started',
  ],
})

/** Status → ikon + ton. Rəng heç vaxt tək siqnal deyil: mətn `activity.status.<type>.<id>` açarındadır. */
export const STATUS_META = Object.freeze({
  material: {
    completed: { icon: '✓', tone: 'green' },
    in_progress: { icon: '▶', tone: 'blue' },
    opened: { icon: '◐', tone: 'yellow' },
    not_opened: { icon: '○', tone: 'gray' },
    overdue: { icon: '!', tone: 'red' },
  },
  assignment: {
    graded: { icon: '✓', tone: 'green' },
    submitted: { icon: '⏳', tone: 'yellow' },
    returned: { icon: '↺', tone: 'yellow' },
    started: { icon: '✎', tone: 'blue' },
    opened: { icon: '◐', tone: 'yellow' },
    overdue: { icon: '!', tone: 'red' },
    not_opened: { icon: '○', tone: 'gray' },
  },
  exam: {
    completed: { icon: '✓', tone: 'green' },
    pending_manual_grading: { icon: '⏳', tone: 'yellow' },
    expired_auto_submitted: { icon: '⌛', tone: 'yellow' },
    in_progress: { icon: '▶', tone: 'blue' },
    inactive: { icon: '⏸', tone: 'yellow' },
    expired_no_answers: { icon: '⌛', tone: 'red' },
    viewed: { icon: '◐', tone: 'gray' },
    not_started: { icon: '○', tone: 'gray' },
  },
})

/** Sətrin status açarı (material üçün «vaxtı keçib» ayrıca göstərilir). */
export function rowStatusKey(type, row) {
  if (!row) return null
  if (type === 'material') return row.overdue ? 'overdue' : row.status || 'not_opened'
  return row.status || (type === 'exam' ? 'not_started' : 'not_opened')
}

export function statusMeta(type, row) {
  const key = rowStatusKey(type, row)
  const meta = STATUS_META[type]?.[key]
  return meta ? { ...meta, key, labelKey: `activity.status.${type}.${key}` } : null
}

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

function line(key, count, tone, icon, filter, { hideZero = false } = {}) {
  return hideZero && !n(count) ? null : { key, count: n(count), tone, icon, filter }
}

/**
 * Kartın əsas sətirləri (spec nümunəsindəki sıra ilə). `filter` = hesabat filtri (null — hamısı).
 * Sıfır olan köməkçi sətirlər (`hideZero`) gizlədilir ki, kart qısa qalsın; əsas sətirlər həmişə görünür.
 */
export function cardLines(type, card) {
  const c = card || {}
  if (type === 'exam') {
    return [
      line('completed', c.completed, 'green', '✓', 'completed'),
      line('in_progress', c.in_progress, 'blue', '▶', 'in_progress'),
      line('inactive', c.inactive, 'yellow', '⏸', 'inactive'),
      line('expired', c.expired, 'red', '⌛', 'expired'),
      line('not_started', c.not_started, 'gray', '○', 'not_started'),
      line('pending_manual_grading', c.pending_manual_grading, 'yellow', '⏳', 'pending_manual_grading', { hideZero: true }),
    ].filter(Boolean)
  }
  if (type === 'assignment') {
    return [
      line('opened', c.opened, 'blue', '◐', 'viewed'),
      line('started', c.started, 'blue', '✎', 'started'),
      line('submitted', c.submitted, 'green', '✓', 'submitted'),
      line('pending_review', c.pending_review ?? c.waiting_grading, 'yellow', '⏳', 'waiting_grading'),
      line('graded', c.graded, 'green', '★', 'graded'),
      line('not_submitted', c.not_submitted, 'gray', '–', 'not_submitted'),
      line('overdue', c.overdue, 'red', '!', 'overdue'),
      line('returned', c.returned, 'yellow', '↺', 'returned', { hideZero: true }),
      line('late_submitted', c.late_submitted, 'yellow', '⏱', 'late', { hideZero: true }),
    ].filter(Boolean)
  }
  return [
    line('viewed', c.viewed, 'green', '✓', 'viewed'),
    line('downloaded', c.unique_downloaders, 'blue', '↓', 'downloaded'),
    line('not_viewed', c.not_viewed, 'gray', '○', 'not_viewed'),
    line('overdue', c.overdue, 'red', '!', 'overdue', { hideZero: true }),
  ].filter(Boolean)
}

/** İmtahan kartında «Baxıb / Başlayıb» kimi ikinci dərəcəli saylar. */
export function examSecondary(card) {
  const c = card || {}
  return { viewed: n(c.viewed), started: n(c.started), auto_submitted: n(c.auto_submitted) }
}

/**
 * Orta nəticə yalnız real, yoxlanmış və cavablı cəhdlər olduqda göstərilir
 * (cavabsız, ləğv edilmiş və əl ilə yoxlama gözləyənlər backend-də çıxarılıb).
 */
export function averageInfo(card) {
  const c = card || {}
  const count = n(c.scored_count)
  if (!count || c.average_score == null) return null
  const score = Number(c.average_score)
  if (!Number.isFinite(score)) return null
  const pct = c.average_pct == null ? null : Number(c.average_pct)
  return { score, pct: Number.isFinite(pct) ? pct : null, max: n(c.max_points) || null, count }
}

/** Ən çox 4 baş hərf + «+N» (göstərilməyənlərin hamısı N-ə daxildir). */
export function stackPeople(people, more = 0, max = 4) {
  const list = Array.isArray(people) ? people.filter(Boolean) : []
  return { shown: list.slice(0, max), more: n(more) + Math.max(0, list.length - max) }
}

/**
 * Nisbi vaxt üçün i18n açarı. 7 gündən köhnə və ya gələcək tarix → `date` (formatDateTime ilə göstərilir).
 * @returns {{ key: 'none'|'justNow'|'minutes'|'hours'|'yesterday'|'days'|'date', count?: number, iso?: string }}
 */
export function relativeTimeParts(iso, now = new Date()) {
  if (!iso) return { key: 'none' }
  const d = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(d.getTime())) return { key: 'none' }
  const diffMin = Math.round((now.getTime() - d.getTime()) / 60000)
  if (diffMin < 0) return { key: 'date', iso: d.toISOString() }
  if (diffMin < 1) return { key: 'justNow' }
  if (diffMin < 60) return { key: 'minutes', count: diffMin }
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return { key: 'hours', count: diffH }
  const diffD = Math.round(diffH / 24)
  if (diffD <= 1) return { key: 'yesterday' }
  if (diffD < 7) return { key: 'days', count: diffD }
  return { key: 'date', iso: d.toISOString() }
}

export function isRecentActivity(iso, now = new Date()) {
  if (!iso) return false
  const d = new Date(iso)
  return !Number.isNaN(d.getTime()) && now - d >= 0 && now - d < 24 * 3600 * 1000
}

/* ------------------------------------------------------------------ */
/* Hesabat sorğusu (URL ↔ API)                                         */
/* ------------------------------------------------------------------ */

export const REPORT_PAGE_SIZE = 50
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** URL axtarış parametrlərindən hesabat vəziyyəti (yanlış dəyərlər atılır). */
export function readReportState(type, search) {
  const get = (k) => (typeof search?.get === 'function' ? search.get(k) : search?.[k]) || ''
  const filter = REPORT_FILTER_IDS[type]?.includes(get('filter')) ? get('filter') : ''
  const status = STATUS_IDS[type]?.includes(get('status')) || (type === 'material' && get('status') === 'overdue') ? get('status') : ''
  const group = UUID_RE.test(get('group')) ? get('group') : ''
  const q = get('q').replace(/\s+/g, ' ').trim().slice(0, 100)
  const from = DATE_RE.test(get('from')) ? get('from') : ''
  const to = DATE_RE.test(get('to')) ? get('to') : ''
  const page = Math.max(1, Number.parseInt(get('page'), 10) || 1)
  return { filter, status, group, q, from, to, page }
}

/** Vəziyyət → URL parametrləri (boşlar və 1-ci səhifə yazılmır). */
export function reportStateToSearch(state) {
  const out = {}
  for (const k of ['filter', 'status', 'group', 'q', 'from', 'to']) {
    if (state?.[k]) out[k] = String(state[k])
  }
  if (state?.page > 1) out.page = String(state.page)
  return out
}

/** Vəziyyət → API parametrləri (həmişə səhifələnir). */
export function reportStateToParams(state, pageSize = REPORT_PAGE_SIZE) {
  const out = reportStateToSearch(state)
  delete out.page
  out.page = String(Math.max(1, Number(state?.page) || 1))
  out.page_size = String(pageSize)
  return out
}

/** Backend-in reminderEligibleFor qaydası ilə eyni (seçim qutuları üçün). */
export function reminderEligible(type, row) {
  if (!row) return false
  if (type === 'material') return !row.viewed
  if (type === 'exam') return !row.started && !row.expired && !row.completed
  return !row.submitted
}

/** Zaman xətti hadisəsi → i18n açarı (`activity.timeline.events.<key>`); naməlum növ «other». */
const TIMELINE_EVENT_KEYS = new Set([
  'material_assigned',
  'material_opened',
  'material_viewed',
  'material_downloaded',
  'material_file_downloaded',
  'video_started',
  'video_progressed',
  'video_completed',
  'file_uploaded',
  'file_downloaded',
  'assignment_opened',
  'assignment_started',
  'assignment_submitted',
  'assignment_late_submitted',
  'assignment_graded',
  'assignment_returned',
  'exam_viewed',
  'exam_started',
  'exam_autosaved',
  'exam_submitted',
  'exam_expired',
  'exam_result_released',
  'exam_attempt_voided',
  'reminder_sent',
])

export function timelineEventKey(eventType) {
  return TIMELINE_EVENT_KEYS.has(eventType) ? eventType : 'other'
}
