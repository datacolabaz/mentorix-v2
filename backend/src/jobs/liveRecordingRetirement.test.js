const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Owner decision: old internal-video recordings are kept for 30 days after the teacher is notified
 * (email + in-app, export link). Deletion is a separate job that only touches recordings noticed >= 30 days
 * ago and is destructive only with LIVE_RECORDING_PURGE_ENABLED=true (default: dry run).
 */

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const DAY = 86400000;
const NOW = new Date('2026-10-01T07:00:00Z');
const state = { handlers: [], queries: [], calls: [], released: [], deletedKeys: [] };

function q(sql, params = []) {
  const flat = sql.replace(/\s+/g, ' ').trim();
  state.queries.push({ sql: flat, params });
  for (const [re, fn] of state.handlers) if (re.test(flat)) return fn(params, flat);
  throw new Error(`unexpected SQL: ${flat.slice(0, 100)}`);
}
function stub(rel, exports) {
  const id = require.resolve(rel);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
stub('../utils/db', { query: async (sql, params) => q(sql, params) });
stub('../services/notificationService', {
  createNotificationSafe: async (input) => {
    state.calls.push(input);
    return { created: true, id: U(900) };
  },
});
stub('../services/liveRecordingQuotaService', {
  releaseRecordingQuota: async (row) => {
    state.released.push(row.id);
  },
});
stub('../services/storage/LocalDiskStorageProvider', {
  getLiveRecordingStorage: () => ({
    delete: async (key) => {
      state.deletedKeys.push(key);
    },
  }),
});

function reset(handlers = []) {
  state.handlers = handlers;
  state.queries = [];
  state.calls = [];
  state.released = [];
  state.deletedKeys = [];
}

const job = require('./liveRecordingRetirement');

test('notice: one mandatory email + in-app per teacher with count and delete-after date (+30 days)', async () => {
  const marks = [];
  reset([
    [/FROM live_recordings lr JOIN users u/, () => ({ rows: [{ instructor_id: U(1), count: 3, bytes: 1.5 * 1024 ** 3 }] })],
    [/^UPDATE live_recordings SET retirement_notice_sent_at/, (p) => (marks.push(p), { rowCount: 3, rows: [] })],
  ]);
  const out = await job.sendRecordingRetirementNotices({ now: NOW });
  assert.deepEqual(out, { teachers: 1, notified: 1, recordings: 3 });
  const c = state.calls[0];
  assert.equal(c.eventType, 'legacy_recordings_retiring');
  assert.equal(c.email, true);
  assert.equal(c.params.count, '3');
  assert.equal(c.params.size, '1.5 GB');
  assert.equal(c.params.deleteAfter, '31.10.2026');
  assert.equal(c.meta.href, '/instructor/live-lessons#legacy-recordings');
  assert.deepEqual(marks[0], [U(1), NOW.toISOString()]);
  const { isMandatory } = require('../config/notificationPolicy');
  assert.equal(isMandatory({ category: 'live_lesson', eventType: 'legacy_recordings_retiring' }), true);
});

test('notice: recordings are not marked when the notification failed', async () => {
  reset([[/FROM live_recordings lr JOIN users u/, () => ({ rows: [{ instructor_id: U(2), count: 1, bytes: 10 }] })]]);
  const ns = require('../services/notificationService');
  const orig = ns.createNotificationSafe;
  ns.createNotificationSafe = async () => ({ created: false, deduped: false, reason: 'error' });
  try {
    const out = await job.sendRecordingRetirementNotices({ now: NOW });
    assert.equal(out.notified, 0);
    assert.ok(!state.queries.some((x) => /^UPDATE live_recordings/.test(x.sql)));
  } finally {
    ns.createNotificationSafe = orig;
  }
});

test('purge: default is a dry run that only logs; cutoff is notice + 30 days', async () => {
  const rows = [{ id: U(10), byte_size: 100, filename: 'a.webm' }, { id: U(11), byte_size: 50, filename: 'b.webm' }];
  reset([[/^SELECT \* FROM live_recordings/, () => ({ rows })]]);
  const logs = [];
  const origLog = console.log;
  console.log = (...a) => logs.push(a.join(' '));
  try {
    const out = await job.purgeNoticedLegacyRecordings({ now: NOW, env: {} });
    assert.deepEqual(out, { dryRun: true, candidates: 2, bytes: 150, deleted: 0 });
  } finally {
    console.log = origLog;
  }
  assert.equal(state.released.length, 0);
  assert.equal(state.deletedKeys.length, 0);
  assert.match(logs.join('\n'), /DRY RUN .*would delete 2 recording/);
  const sel = state.queries[0];
  assert.match(sel.sql, /retirement_notice_sent_at IS NOT NULL AND retirement_notice_sent_at <= \$1::timestamptz/);
  assert.equal(sel.params[0], new Date(NOW.getTime() - 30 * DAY).toISOString());

  for (const v of ['1', 'yes', 'TRUE ', 'false', '']) {
    assert.equal(job.purgeEnabled({ LIVE_RECORDING_PURGE_ENABLED: v }), v.trim().toLowerCase() === 'true');
  }
});

test('purge: deletes (quota release + file) only with LIVE_RECORDING_PURGE_ENABLED=true', async () => {
  reset([[/^SELECT \* FROM live_recordings/, () => ({ rows: [{ id: U(12), byte_size: 1, filename: 'c.webm' }] })]]);
  const origLog = console.log;
  console.log = () => {};
  try {
    const out = await job.purgeNoticedLegacyRecordings({ now: NOW, env: { LIVE_RECORDING_PURGE_ENABLED: 'true' } });
    assert.equal(out.dryRun, false);
    assert.equal(out.deleted, 1);
  } finally {
    console.log = origLog;
  }
  assert.deepEqual(state.released, [U(12)]);
  assert.deepEqual(state.deletedKeys, ['c.webm']);
});

test('delete-after date exposed to the export list; notice copy in az/en/ru', () => {
  assert.equal(job.recordingDeleteAfter(null), null);
  assert.equal(job.recordingDeleteAfter('2026-10-01T07:00:00.000Z'), '2026-10-31T07:00:00.000Z');
  const { renderTemplate } = require('../services/notificationTemplates');
  const { renderEmail } = require('../services/email/emailTemplates');
  const params = { count: '3', size: '1.5 GB', deleteAfter: '31.10.2026' };
  for (const l of ['az', 'en', 'ru']) {
    const a = renderTemplate('legacy_recordings_retiring', l, params);
    assert.match(a.title, /31\.10\.2026/);
    assert.doesNotMatch(a.body, /\{\{/);
    const m = renderEmail('legacy_recordings_retiring', l, params, { env: { FRONTEND_PUBLIC_URL: 'https://app.example' } });
    assert.match(m.text, /31\.10\.2026/);
  }
});
