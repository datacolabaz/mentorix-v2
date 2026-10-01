import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  badgeLabel,
  categoryIconName,
  isHighPriority,
  isSafeInternalHref,
  notificationText,
  NOTIFICATION_CATEGORIES,
} from './notificationPresentation.js'

describe('notificationPresentation', () => {
  it('badge label caps at 99+', () => {
    assert.equal(badgeLabel(0), '')
    assert.equal(badgeLabel(undefined), '')
    assert.equal(badgeLabel(7), '7')
    assert.equal(badgeLabel(99), '99')
    assert.equal(badgeLabel(100), '99+')
  })

  it('every category has an icon', () => {
    for (const c of NOTIFICATION_CATEGORIES) assert.ok(categoryIconName(c))
    assert.equal(categoryIconName('unknown'), 'notifications')
  })

  it('priority indicator only for HIGH/CRITICAL', () => {
    assert.equal(isHighPriority('CRITICAL'), true)
    assert.equal(isHighPriority('HIGH'), true)
    assert.equal(isHighPriority('NORMAL'), false)
  })

  it('re-renders templated notifications in the UI language, falls back to stored text', () => {
    const calls = []
    const t = (key, opts) => {
      calls.push({ key, opts })
      return key.endsWith('.title') ? 'New join request' : `${opts.studentName} → ${opts.groupName}`
    }
    const out = notificationText(
      { title: 'Yeni qoşulma sorğusu', body: 'az body', i18n: { key: 'join_request', params: { studentName: 'Aysel', groupName: 'A1' } } },
      t,
    )
    assert.deepEqual(out, { title: 'New join request', body: 'Aysel → A1' })
    assert.equal(calls[0].opts.defaultValue, 'Yeni qoşulma sorğusu')
    assert.deepEqual(notificationText({ title: 'Legacy', body: 'b' }, t), { title: 'Legacy', body: 'b' })
    assert.deepEqual(notificationText({ title: 'X', body: 'y', i18n: { key: '../evil' } }, t), { title: 'X', body: 'y' })
  })

  it('only internal hrefs are navigable', () => {
    assert.equal(isSafeInternalHref('/student/assignments'), true)
    assert.equal(isSafeInternalHref('//evil.example'), false)
    assert.equal(isSafeInternalHref('https://evil.example'), false)
    assert.equal(isSafeInternalHref(null), false)
  })
})
