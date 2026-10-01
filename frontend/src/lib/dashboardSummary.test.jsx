import { describe, expect, it } from 'vitest'
import az from '../locales/az/translation.json'
import en from '../locales/en/translation.json'
import ru from '../locales/ru/translation.json'
import { ITEM_ICONS, attentionCount, formatCents, itemDetail, itemStatus, summaryEnrollmentId } from './dashboardSummary'

describe('summaryEnrollmentId', () => {
  it('filters only by enrollments the server accepts', () => {
    expect(summaryEnrollmentId({ enrollment_id: 'e1', status: 'active' })).toBe('e1')
    expect(summaryEnrollmentId({ enrollment_id: 'e2', status: ' Pending_Setup ' })).toBe('e2')
    expect(summaryEnrollmentId({ enrollment_id: 'e3', status: null })).toBe('e3')
    expect(summaryEnrollmentId({ enrollment_id: 'e4', status: 'pending_approval' })).toBe('')
    expect(summaryEnrollmentId(null)).toBe('')
  })
})

describe('itemStatus: icon + text key + tone', () => {
  it('unavailable and zero are neutral', () => {
    expect(itemStatus({ key: 'x', available: false, count: 0 })).toEqual({ key: 'unavailable', icon: '?', tone: 'gray' })
    expect(itemStatus({ key: 'x', available: true, count: 0, tone: 'red' })).toEqual({ key: 'none', icon: '✓', tone: 'gray' })
  })

  it('admin severity wins over tone', () => {
    expect(itemStatus({ available: true, count: 2, severity: 'critical' }).key).toBe('urgent')
    expect(itemStatus({ available: true, count: 2, severity: 'warning' }).key).toBe('review')
  })

  it('teacher/student tones map to distinct statuses', () => {
    expect(itemStatus({ available: true, count: 1, tone: 'red' })).toMatchObject({ key: 'urgent', icon: '!' })
    expect(itemStatus({ available: true, count: 1, tone: 'yellow' })).toMatchObject({ key: 'review', icon: '⏳' })
    expect(itemStatus({ available: true, count: 1, tone: 'green' })).toMatchObject({ key: 'ready', icon: '✓' })
    expect(itemStatus({ available: true, count: 1, tone: 'gray' })).toMatchObject({ key: 'info', icon: '○' })
    expect(itemStatus({ available: true, count: 1, tone: 'blue' })).toMatchObject({ key: 'new', icon: '●' })
  })
})

describe('itemDetail', () => {
  it('commission detail formats cents', () => {
    const d = itemDetail({
      key: 'commission_actions',
      available: true,
      count: 3,
      detail: { pending_payouts: 1, pending_payout_cents: 1250, pending_commissions: 2 },
    })
    expect(d.values).toEqual({ payouts: 1, amount: '₼12.50', commissions: 2 })
  })

  it('date details carry the ISO value separately', () => {
    const d = itemDetail({ key: 'upcoming_deadlines', available: true, count: 1, detail: { next_at: '2026-09-29T17:34:00Z' } })
    expect(d.dateIso).toBe('2026-09-29T17:34:00Z')
  })

  it('no detail for unavailable items or empty overdue', () => {
    expect(itemDetail({ key: 'pending_grading', available: false })).toBeNull()
    expect(itemDetail({ key: 'overdue_assignments', available: true, count: 0, detail: { assignments: 0 } })).toBeNull()
  })
})

it('attentionCount counts only available items with work', () => {
  expect(
    attentionCount([
      { available: true, count: 2 },
      { available: true, count: 0 },
      { available: false, count: 0 },
    ]),
  ).toBe(1)
  expect(formatCents(null)).toBe('₼0.00')
})

describe('locales: every widget string exists in az, en and ru', () => {
  const keys = Object.keys(ITEM_ICONS)
  const statusKeys = ['unavailable', 'none', 'urgent', 'review', 'new', 'ready', 'info']
  for (const [lang, res] of Object.entries({ az, en, ru })) {
    it(lang, () => {
      const ds = res.dashboardSummary
      for (const k of keys) expect(ds.items[k], `${lang} items.${k}`).toBeTruthy()
      for (const k of statusKeys) expect(ds.status[k], `${lang} status.${k}`).toBeTruthy()
      for (const role of ['admin', 'teacher', 'student']) {
        expect(ds.title[role]).toBeTruthy()
        expect(ds.subtitle[role]).toBeTruthy()
      }
      for (const k of Object.keys(az.dashboardSummary.detail)) expect(ds.detail[k], `${lang} detail.${k}`).toBeTruthy()
      for (const k of Object.keys(az.dashboardSummary.activity.events)) expect(ds.activity.events[k]).toBeTruthy()
      for (const k of Object.keys(az.adminOperations.omitted)) expect(res.adminOperations.omitted[k]).toBeTruthy()
    })
  }
})
