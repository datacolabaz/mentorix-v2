import test from 'node:test'
import assert from 'node:assert/strict'
import {
  REPORT_FILTER_IDS,
  averageInfo,
  cardLines,
  readReportState,
  relativeTimeParts,
  reminderEligible,
  reportStateToParams,
  reportStateToSearch,
  stackPeople,
  statusMeta,
  timelineEventKey,
} from './activityCards.js'

/** Backend CARD_FILTER_PARITY ilə eyni: kart sətri hansı hesabat filtrini açırsa, o filtr mövcud olmalıdır. */
const BACKEND_PARITY = {
  material: { viewed: 'viewed', not_viewed: 'not_viewed', unique_downloaders: 'downloaded', overdue: 'overdue' },
  assignment: {
    opened: 'viewed',
    started: 'started',
    submitted: 'submitted',
    pending_review: 'waiting_grading',
    graded: 'graded',
    not_submitted: 'not_submitted',
    overdue: 'overdue',
    returned: 'returned',
    late_submitted: 'late',
  },
  exam: {
    completed: 'completed',
    in_progress: 'in_progress',
    inactive: 'inactive',
    expired: 'expired',
    not_started: 'not_started',
    pending_manual_grading: 'pending_manual_grading',
  },
}

test('every card line opens a report filter that exists and matches the backend parity map', () => {
  const full = {
    viewed: 3, not_viewed: 2, unique_downloaders: 2, overdue: 1, opened: 4, started: 3, submitted: 2, pending_review: 1,
    graded: 1, not_submitted: 2, returned: 1, late_submitted: 1, completed: 5, in_progress: 1, inactive: 1, expired: 1,
    not_started: 2, pending_manual_grading: 1,
  }
  for (const type of ['material', 'assignment', 'exam']) {
    for (const l of cardLines(type, full)) {
      assert.ok(REPORT_FILTER_IDS[type].includes(l.filter), `${type}.${l.key} → ${l.filter}`)
      const field = l.key === 'downloaded' ? 'unique_downloaders' : l.key
      assert.equal(BACKEND_PARITY[type][field], l.filter, `${type}.${field}`)
      assert.equal(l.count, full[field])
    }
  }
})

test('exam card follows the spec order and hides an empty grading line', () => {
  const lines = cardLines('exam', { completed: 17, in_progress: 2, inactive: 3, expired: 1, not_started: 1 })
  assert.deepEqual(lines.map((l) => [l.key, l.count]), [
    ['completed', 17], ['in_progress', 2], ['inactive', 3], ['expired', 1], ['not_started', 1],
  ])
})

test('average is shown only when real scored attempts exist', () => {
  assert.equal(averageInfo({ scored_count: 0, average_score: null }), null)
  assert.equal(averageInfo({ scored_count: 0, average_score: 5 }), null)
  assert.deepEqual(averageInfo({ scored_count: 2, average_score: 6, average_pct: 60, max_points: 10 }), {
    score: 6, pct: 60, max: 10, count: 2,
  })
})

test('viewer stack shows at most 4 initials and counts the rest', () => {
  const people = [1, 2, 3, 4, 5].map((i) => ({ student_id: `s${i}`, full_name: `S ${i}` }))
  assert.deepEqual(stackPeople(people, 3).shown.length, 4)
  assert.equal(stackPeople(people, 3).more, 4)
  assert.equal(stackPeople([], 0).more, 0)
})

test('status meta always carries icon, tone and a label key', () => {
  const m = statusMeta('exam', { status: 'expired_auto_submitted' })
  assert.deepEqual([m.icon, m.tone, m.labelKey], ['⌛', 'yellow', 'activity.status.exam.expired_auto_submitted'])
  assert.equal(statusMeta('material', { status: 'opened', overdue: true }).key, 'overdue')
  assert.equal(statusMeta('assignment', { status: 'weird' }), null)
})

test('relative time keys', () => {
  const now = new Date('2026-09-29T17:34:00Z')
  assert.deepEqual(relativeTimeParts(null, now), { key: 'none' })
  assert.deepEqual(relativeTimeParts('2026-09-29T17:33:40Z', now), { key: 'justNow' })
  assert.deepEqual(relativeTimeParts('2026-09-29T17:29:00Z', now), { key: 'minutes', count: 5 })
  assert.deepEqual(relativeTimeParts('2026-09-29T14:34:00Z', now), { key: 'hours', count: 3 })
  assert.deepEqual(relativeTimeParts('2026-09-28T12:00:00Z', now), { key: 'yesterday' })
  assert.deepEqual(relativeTimeParts('2026-09-25T12:00:00Z', now), { key: 'days', count: 4 })
  assert.equal(relativeTimeParts('2026-09-01T12:00:00Z', now).key, 'date')
  assert.equal(relativeTimeParts('2026-10-01T12:00:00Z', now).key, 'date')
})

test('report state is whitelisted from the URL and round-trips to API params', () => {
  const s = readReportState('exam', new URLSearchParams('filter=inactive&status=drop table&group=nope&q=  Aysel  &from=2026-09-01&to=bad&page=3'))
  assert.deepEqual(s, { filter: 'inactive', status: '', group: '', q: 'Aysel', from: '2026-09-01', to: '', page: 3 })
  assert.equal(readReportState('material', { filter: 'inactive' }).filter, '', 'exam-only filter rejected for materials')
  assert.deepEqual(reportStateToSearch({ ...s, page: 1 }), { filter: 'inactive', q: 'Aysel', from: '2026-09-01' })
  assert.deepEqual(reportStateToParams(s, 25), { filter: 'inactive', q: 'Aysel', from: '2026-09-01', page: '3', page_size: '25' })
})

test('reminder eligibility mirrors the backend rule', () => {
  assert.equal(reminderEligible('material', { viewed: false }), true)
  assert.equal(reminderEligible('material', { viewed: true }), false)
  assert.equal(reminderEligible('assignment', { submitted: false }), true)
  assert.equal(reminderEligible('exam', { started: false, expired: false, completed: false }), true)
  assert.equal(reminderEligible('exam', { started: false, expired: true }), false)
  assert.equal(reminderEligible('exam', { started: true }), false)
})

test('unknown timeline events fall back to a generic label', () => {
  assert.equal(timelineEventKey('exam_started'), 'exam_started')
  assert.equal(timelineEventKey('<script>'), 'other')
})
