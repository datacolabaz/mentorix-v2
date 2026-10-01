const test = require('node:test');
const assert = require('node:assert/strict');

const { formatDateTime, formatDateOnly } = require('./formatDateTime');

test('az / ru: "29.09.2026, 21:34" in Baku time', () => {
  assert.equal(formatDateTime('2026-09-29T17:34:00Z', 'az'), '29.09.2026, 21:34');
  assert.equal(formatDateTime(new Date('2026-09-29T17:34:00Z'), 'ru'), '29.09.2026, 21:34');
});

test('en: "Sep 29, 2026, 21:34"', () => {
  assert.equal(formatDateTime('2026-09-29T17:34:00Z', 'en'), 'Sep 29, 2026, 21:34');
  assert.equal(formatDateTime('2026-01-05T08:05:00Z', 'en'), 'Jan 5, 2026, 12:05');
});

test('date only', () => {
  assert.equal(formatDateOnly('2026-09-29', 'az'), '29.09.2026');
  assert.equal(formatDateOnly('2026-09-29', 'en'), 'Sep 29, 2026');
});

test('invalid input → empty string', () => {
  assert.equal(formatDateTime(null, 'az'), '');
  assert.equal(formatDateTime('not a date', 'en'), '');
});
