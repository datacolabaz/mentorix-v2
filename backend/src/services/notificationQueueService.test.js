const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const dbPath = path.join(__dirname, '../utils/db.js');
const calls = [];
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [] };
    },
    transaction: async () => {
      throw new Error('not used');
    },
  },
};

const q = require('./notificationQueueService');

const notifRow = { id: 'q1', template_key: 'join_request', retry_count: 0 };
const legacyRow = { id: 'q2', template_key: null, retry_count: 0 };

test('outcome → queue status and notification email_status', () => {
  assert.deepEqual(q.outcomeStatuses(notifRow, { kind: 'sent' }), { queue: 'sent', notification: 'sent' });
  assert.deepEqual(q.outcomeStatuses(notifRow, { kind: 'dry_run' }), { queue: 'dry_run', notification: 'dry_run' });
  assert.deepEqual(q.outcomeStatuses(notifRow, { kind: 'skipped' }), { queue: 'skipped', notification: 'skipped' });
  assert.deepEqual(q.outcomeStatuses(notifRow, { kind: 'suppressed' }), { queue: 'suppressed', notification: null });
  assert.equal(q.outcomeStatuses(notifRow, { kind: 'failed' }).notification, 'failed');
  assert.throws(() => q.outcomeStatuses(notifRow, { kind: 'bogus' }), /unknown outcome/);
});

test('retry: notification rows go back to queued, legacy rows to retrying; stop at MAX_RETRIES', () => {
  assert.equal(q.MAX_RETRIES, 3);
  assert.deepEqual(q.outcomeStatuses(notifRow, { kind: 'retry' }), { queue: 'queued', notification: null, retryCount: 1, backoff: 1 });
  assert.deepEqual(q.outcomeStatuses(legacyRow, { kind: 'retry' }), { queue: 'retrying', notification: null, retryCount: 1, backoff: 1 });
  assert.equal(q.outcomeStatuses({ ...notifRow, retry_count: 1 }, { kind: 'retry' }).backoff, 5);
  assert.deepEqual(q.outcomeStatuses({ ...notifRow, retry_count: 2 }, { kind: 'retry' }), { queue: 'failed', notification: 'failed', retryCount: 3 });
  assert.equal(q.outcomeStatuses(notifRow, { kind: 'retry', transient: false }).queue, 'failed');
});

test('claimDue uses SKIP LOCKED, only picks due rows and reclaims stale sending rows as an attempt', async () => {
  calls.length = 0;
  await q.claimDue(500);
  const { sql, params } = calls[0];
  assert.match(sql, /FOR UPDATE SKIP LOCKED/);
  assert.match(sql, /status IN \('pending', 'retrying', 'queued'\) AND next_retry_at <= NOW\(\)/);
  assert.match(sql, /status = 'sending' AND locked_at < NOW\(\)/);
  assert.match(sql, /retry_count = CASE WHEN nq\.status = 'sending' THEN nq\.retry_count \+ 1/);
  assert.doesNotMatch(sql, /'suppressed'|'skipped'|'dry_run'|'failed'/, 'terminal rows are never re-claimed');
  assert.equal(params[0], 200, 'batch size is capped');
});

test('failed deliveries are queryable without addresses, subjects or bodies', async () => {
  calls.length = 0;
  await q.listFailedEmailDeliveries({ sinceHours: 48, limit: 10 });
  await q.failedEmailDeliverySummary({ sinceHours: 24 });
  for (const { sql } of calls) {
    assert.match(sql, /status = 'failed' AND channel = 'email'/);
    assert.doesNotMatch(sql, /to_addr|subject|body/);
  }
  assert.deepEqual(calls[0].params, ['48', 10]);
});

test('unique key per notification is stable (dedupe across retries and replicas)', () => {
  assert.equal(q.notificationEmailUniqueKey('abc'), 'email:notification:abc');
  assert.equal(q.isNotificationRow(notifRow), true);
  assert.equal(q.isNotificationRow(legacyRow), false);
});
