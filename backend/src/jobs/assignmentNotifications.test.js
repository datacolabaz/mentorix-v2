const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * D20: müəllimin əl ilə xatırlatması avtomatik 24 saatlıq xatırlatmanı söndürmür; avtomatik yalnız
 * son 6 saatdakı əl ilə xatırlatmanı gözləyir. Bildirişlər notificationService-dən sabit dedupe açarı ilə.
 */

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOW = new Date();
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600000).toISOString();

const { bakuTodayYmd } = require('../services/assignmentHomeworkService');
const TODAY = bakuTodayYmd(NOW);
const YESTERDAY = bakuTodayYmd(new Date(NOW.getTime() - 24 * 3600000));

const state = { rows: [], updates: [], calls: [] };

const dbId = require.resolve('../utils/db');
require.cache[dbId] = {
  id: dbId,
  filename: dbId,
  loaded: true,
  exports: {
    query: async (sql, params) => {
      if (/FROM student_assignments a/.test(sql)) return { rows: state.rows };
      if (/UPDATE student_assignments SET (\w+)/.test(sql)) {
        state.updates.push([/SET (\w+)/.exec(sql)[1], params[0]]);
        return { rows: [] };
      }
      throw new Error(`unexpected SQL: ${sql.slice(0, 60)}`);
    },
  },
};

const nsId = require.resolve('../services/notificationService');
require.cache[nsId] = {
  id: nsId,
  filename: nsId,
  loaded: true,
  exports: {
    createNotificationSafe: async (input) => {
      state.calls.push(input);
      return { created: true, deduped: false, id: U(500 + state.calls.length) };
    },
  },
};

const { runAssignmentNotifications } = require('./assignmentNotifications');

function row(n, extra = {}) {
  return {
    student_assignment_id: U(100 + n),
    student_id: U(n),
    assignment_id: U(900),
    instructor_id: U(999),
    title: 'Faiz',
    due_date: TODAY,
    status: 'pending',
    reminder_sent_at: null,
    overdue_notified_at: null,
    last_manual_reminder_at: null,
    reminder_sent_by_manual: false,
    ...extra,
  };
}

function reset(rows) {
  state.rows = rows;
  state.updates = [];
  state.calls = [];
}

test('auto reminder still fires after an old manual reminder (D20)', async () => {
  reset([row(1, { last_manual_reminder_at: hoursAgo(10) })]);
  const s = await runAssignmentNotifications({ now: NOW });
  assert.equal(s.reminded, 1);
  assert.equal(state.calls.length, 1);
  const n = state.calls[0];
  assert.equal(n.eventType, 'assignment_reminder');
  assert.equal(n.templateKey, 'assignment_due_soon');
  assert.equal(n.meta.reminder_kind, 'auto');
  assert.equal(n.dedupeKey, `assignment_reminder:auto:${U(101)}:${TODAY}`);
  assert.deepEqual(state.updates, [['reminder_sent_at', U(101)]]);
});

test('auto reminder respects the 6h cooldown after a manual reminder, and retries later', async () => {
  reset([row(2, { last_manual_reminder_at: hoursAgo(2) })]);
  const s = await runAssignmentNotifications({ now: NOW });
  assert.deepEqual([s.reminded, s.deferred], [0, 1]);
  assert.equal(state.calls.length, 0);
  assert.equal(state.updates.length, 0, 'reminder_sent_at untouched → next hourly run can send it');
});

test('legacy row whose reminder_sent_at was written by a manual reminder is not treated as auto-sent', async () => {
  reset([row(3, { reminder_sent_at: hoursAgo(8), last_manual_reminder_at: hoursAgo(8), reminder_sent_by_manual: true })]);
  const s = await runAssignmentNotifications({ now: NOW });
  assert.equal(s.reminded, 1);
});

test('an automatic reminder already sent is not repeated', async () => {
  reset([row(4, { reminder_sent_at: hoursAgo(3), reminder_sent_by_manual: false })]);
  const s = await runAssignmentNotifications({ now: NOW });
  assert.equal(s.reminded, 0);
  assert.equal(state.calls.length, 0);
});

test('overdue notice goes through the service once per student assignment', async () => {
  reset([row(5, { due_date: YESTERDAY })]);
  const s = await runAssignmentNotifications({ now: NOW });
  assert.equal(s.overdue, 1);
  assert.equal(state.calls[0].eventType, 'assignment_overdue');
  assert.equal(state.calls[0].dedupeKey, `assignment_overdue:${U(105)}`);
  assert.deepEqual(state.updates, [['overdue_notified_at', U(105)]]);
});
