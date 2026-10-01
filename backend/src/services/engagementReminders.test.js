const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Əl ilə xatırlatma: önizləmə heç nə yazmır, soyuma müddəti (6 saat) təkrarı bloklayır, eyni anda iki klik
 * ikiqat xatırlatma yaratmır, çatdırılma nəticəsi (sent/failed) və REMINDER_SENT yazılır, imtahan qaydaları.
 * DB yoxdur: sorğular yaddaşdakı cədvəllərə yazan saxta client ilə əvəzlənir.
 */

const OWNER = 'teacher-1';
const OTHER = 'teacher-2';
const NOW = new Date('2026-10-01T10:00:00Z');

const ASSIGNMENTS = [{ id: 'a1', instructor_id: OWNER, title: 'Faiz məsələləri', due_date: '2026-10-05', created_at: NOW, group_name: '7A' }];
const ASSIGNMENT_ROWS = [
  { student_assignment_id: 'sa1', assignment_id: 'a1', student_id: 's1', full_name: 'Aysel', status: 'submitted', submitted_at: '2026-09-30T10:00:00Z' },
  { student_assignment_id: 'sa2', assignment_id: 'a1', student_id: 's2', full_name: 'Babək', status: 'pending' },
  { student_assignment_id: 'sa3', assignment_id: 'a1', student_id: 's3', full_name: 'Cavid', status: 'pending', first_opened_at: '2026-09-30T09:00:00Z' },
  { student_assignment_id: 'sa4', assignment_id: 'a1', student_id: 's4', full_name: 'Dilarə', status: 'returned', returned_at: '2026-09-30T11:00:00Z' },
];
const EXAMS = [
  { id: 'e1', instructor_id: OWNER, title: 'Riyaziyyat KSQ 1', max_points: '10', created_at: NOW, available_until: '2026-10-02T10:00:00Z' },
  { id: 'e2', instructor_id: OWNER, title: 'Bağlı imtahan', max_points: '10', created_at: NOW, available_until: '2026-09-30T10:00:00Z' },
];
const EXAM_ROSTER = [
  { exam_id: 'e1', student_id: 's1', full_name: 'Aysel', status: 'in_progress', started_at: '2026-10-01T09:55:00Z', latest_activity_at: '2026-10-01T09:58:00Z', result_status: 'in_progress' },
  { exam_id: 'e1', student_id: 's2', full_name: 'Babək', status: 'viewed', viewed_at: '2026-10-01T07:00:00Z' },
  { exam_id: 'e1', student_id: 's3', full_name: 'Cavid' },
  { exam_id: 'e1', student_id: 's4', full_name: 'Dilarə', status: 'expired_no_answers', started_at: '2026-10-01T08:00:00Z', expired_at: '2026-10-01T08:30:00Z', result_status: 'expired' },
  { exam_id: 'e2', student_id: 's3', full_name: 'Cavid' },
];
const LOCALES = { s2: 'en', s3: 'az', s4: 'ru' };

const state = { reminderLog: [], notifications: [], activity: [], updates: [], txQueries: [], failFor: new Set(), writesOutsideTx: 0 };
function resetState() {
  state.reminderLog = [];
  state.notifications = [];
  state.activity = [];
  state.updates = [];
  state.txQueries = [];
  state.failFor = new Set();
  state.writesOutsideTx = 0;
}

const owned = (list, owner, ids) => list.filter((x) => x.instructor_id === owner && (!ids || ids.includes(x.id)));

function readQuery(sql, params) {
  if (/^\s*(INSERT|UPDATE|DELETE)/i.test(sql)) state.writesOutsideTx += 1;
  if (/exam_group_names/.test(sql)) return { rows: [] };
  if (/reminder_locales/.test(sql)) return { rows: params[0].map((id) => ({ id, locale: LOCALES[id] || null })) };
  if (/reminder_recent/.test(sql)) {
    const [entityType, entityId, ids, nowIso, hours] = params;
    const since = new Date(nowIso).getTime() - hours * 3600000;
    const last = new Map();
    for (const r of state.reminderLog) {
      if (r.entity_type !== entityType || r.entity_id !== entityId || r.status !== 'sent' || !ids.includes(r.student_id)) continue;
      if (r.sent_at.getTime() <= since) continue;
      last.set(r.student_id, r.sent_at);
    }
    return { rows: [...last.entries()].map(([student_id, last_sent_at]) => ({ student_id, last_sent_at })) };
  }
  if (/FROM assignments a/.test(sql)) return { rows: owned(ASSIGNMENTS, params[0], params[1]) };
  if (/FROM student_assignments sa/.test(sql)) return { rows: ASSIGNMENT_ROWS.filter((r) => params[0].includes(r.assignment_id)) };
  if (/WITH ex AS/.test(sql)) {
    const allowed = owned(EXAMS, params[0], params[1]).map((e) => e.id);
    return { rows: EXAM_ROSTER.filter((r) => allowed.includes(r.exam_id) && params[1].includes(r.exam_id)) };
  }
  if (/FROM exams e/.test(sql)) return { rows: owned(EXAMS, params[0], params[1]) };
  if (/report_timeline/.test(sql)) {
    return {
      rows: [
        { event_type: 'exam_started', created_at: '2026-10-01T09:55:00Z', source: 'server', metadata: { answers: { q1: 'A' } } },
        { event_type: 'reminder_sent', created_at: '2026-10-01T09:56:00Z', source: 'server', metadata: { delivery: 'delivered', batch_id: 'x' } },
      ],
    };
  }
  throw new Error(`unexpected SQL: ${sql.slice(0, 80)}`);
}

let lockChain = Promise.resolve();
function makeClient() {
  let release = null;
  const client = {
    async query(sql, params = []) {
      state.txQueries.push(sql.trim().split(/\s+/).slice(0, 3).join(' '));
      if (/pg_advisory_xact_lock/.test(sql)) {
        const prev = lockChain;
        lockChain = new Promise((r) => {
          release = r;
        });
        await prev;
        return { rows: [] };
      }
      if (/^\s*(SAVEPOINT|RELEASE|ROLLBACK TO)/.test(sql)) return { rows: [] };
      if (/INSERT INTO notifications/.test(sql)) {
        if (state.failFor.has(params[0])) {
          const err = new Error('boom');
          err.code = '23503';
          throw err;
        }
        const id = `n${state.notifications.length + 1}`;
        state.notifications.push({ id, user_id: params[0], title: params[1], body: params[2], type: params[3], meta: JSON.parse(params[4]) });
        return { rows: [{ id }] };
      }
      if (/INSERT INTO reminder_log/.test(sql)) {
        const skipped = /'skipped_recent'/.test(sql);
        state.reminderLog.push(
          skipped
            ? { instructor_id: params[0], entity_type: params[1], entity_id: params[2], student_id: params[3], status: 'skipped_recent', batch_id: params[4], sent_at: NOW }
            : {
                instructor_id: params[0],
                entity_type: params[1],
                entity_id: params[2],
                student_id: params[3],
                channel: params[4],
                status: params[5],
                notification_id: params[6],
                message_preview: params[7],
                batch_id: params[8],
                error_code: params[9],
                sent_at: NOW,
              },
        );
        return { rows: [] };
      }
      if (/INSERT INTO student_activity_log/.test(sql)) {
        state.activity.push({ student_id: params[0], entity_type: params[2], entity_id: params[3], event_type: params[4], metadata: JSON.parse(params[5]), dedupe_key: params[7] });
        return { rows: [{ id: state.activity.length }] };
      }
      if (/UPDATE student_assignments/.test(sql)) {
        state.updates.push(params);
        return { rows: [] };
      }
      return readQuery(sql, params);
    },
    end() {
      if (release) release();
    },
  };
  return client;
}

const dbId = require.resolve('../utils/db');
require.cache[dbId] = {
  id: dbId,
  filename: dbId,
  loaded: true,
  exports: {
    query: async (sql, params) => readQuery(sql, params),
    transaction: async (cb) => {
      const client = makeClient();
      try {
        return await cb(client);
      } finally {
        client.end();
      }
    },
  },
};

const svc = require('./engagementService');

test('preview lists recipients, cooldown and message without writing anything', async () => {
  resetState();
  const p = await svc.previewReminders(OWNER, 'assignment', 'a1', { now: NOW });
  assert.deepEqual(p.recipients.map((r) => r.student_id).sort(), ['s2', 's3', 's4'], 'not-submitted (incl. returned) only');
  assert.deepEqual(p.not_eligible.map((r) => r.student_id), ['s1']);
  assert.equal(p.counts.recipients, 3);
  assert.equal(p.cooldown_hours, svc.REMINDER_COOLDOWN_HOURS);
  assert.deepEqual(p.messages.map((m) => [m.locale, m.count]), [['az', 1], ['en', 1], ['ru', 1]]);
  assert.match(p.messages.find((m) => m.locale === 'az').body, /«Faiz məsələləri» tapşırığını/);
  assert.equal(state.writesOutsideTx, 0);
  assert.equal(state.txQueries.length, 0, 'no transaction opened by a preview');
});

test('send: one in-app notification per recipient, logged with delivery outcome and REMINDER_SENT', async () => {
  resetState();
  const r = await svc.sendReminders(OWNER, 'assignment', 'a1', { studentIds: ['s2', 's3', 's1'], now: NOW });
  assert.equal(r.sent, 2);
  assert.equal(r.not_eligible, 1, 's1 already submitted');
  assert.equal(r.failed, 0);
  assert.ok(r.batch_id);
  const byStudent = (a, b) => String(a[0]).localeCompare(String(b[0]));
  assert.deepEqual(state.notifications.map((n) => [n.user_id, n.type]).sort(byStudent), [['s2', 'assignment_reminder'], ['s3', 'assignment_reminder']]);
  const toS2 = state.notifications.find((n) => n.user_id === 's2');
  assert.equal(toS2.title, 'Reminder', 's2 prefers English');
  assert.equal(toS2.meta.assignment_id, 'a1');
  assert.deepEqual(
    state.reminderLog
      .map((l) => [l.student_id, l.status, state.notifications.find((n) => n.user_id === l.student_id).id === l.notification_id, l.batch_id === r.batch_id])
      .sort(byStudent),
    [['s2', 'sent', true, true], ['s3', 'sent', true, true]],
  );
  assert.ok(state.reminderLog.every((l) => l.message_preview && !/\d+ bal/.test(l.message_preview)));
  assert.deepEqual(
    state.activity.map((a) => [a.student_id, a.event_type, a.metadata.delivery]).sort(byStudent),
    [['s2', 'reminder_sent', 'delivered'], ['s3', 'reminder_sent', 'delivered']],
  );
  const lockAt = state.txQueries.findIndex((q) => /pg_advisory_xact_lock/.test(q));
  const recentAt = state.txQueries.findIndex((q) => /reminder_recent/.test(q));
  assert.ok(lockAt >= 0 && recentAt > lockAt, 'cooldown is re-checked after taking the lock');
});

test('duplicate reminder within the cooldown is skipped, not re-sent', async () => {
  resetState();
  await svc.sendReminders(OWNER, 'assignment', 'a1', { studentIds: ['s2'], now: NOW });
  const again = await svc.sendReminders(OWNER, 'assignment', 'a1', { studentIds: ['s2'], now: new Date(NOW.getTime() + 3600000) });
  assert.equal(again.sent, 0);
  assert.equal(again.skipped_recent, 1);
  assert.equal(state.notifications.length, 1);
  const preview = await svc.previewReminders(OWNER, 'assignment', 'a1', { studentIds: ['s2'], now: NOW });
  assert.deepEqual(preview.recently_reminded.map((r) => r.student_id), ['s2']);
  assert.equal(preview.recipients.length, 0);
  const later = await svc.sendReminders(OWNER, 'assignment', 'a1', { studentIds: ['s2'], now: new Date(NOW.getTime() + 7 * 3600000) });
  assert.equal(later.sent, 1, 'allowed again after 6 hours');
});

test('double click: two concurrent sends produce one notification per student', async () => {
  resetState();
  const [a, b] = await Promise.all([
    svc.sendReminders(OWNER, 'assignment', 'a1', { now: NOW }),
    svc.sendReminders(OWNER, 'assignment', 'a1', { now: NOW }),
  ]);
  assert.equal(a.sent + b.sent, 3);
  assert.equal(a.skipped_recent + b.skipped_recent, 3);
  assert.equal(state.notifications.length, 3);
  assert.equal(new Set(state.notifications.map((n) => n.user_id)).size, 3);
});

test('a failed delivery is recorded as failed and does not block the others', async () => {
  resetState();
  state.failFor.add('s3');
  const r = await svc.sendReminders(OWNER, 'assignment', 'a1', { now: NOW });
  assert.equal(r.sent, 2);
  assert.equal(r.failed, 1);
  const failed = state.reminderLog.find((l) => l.student_id === 's3');
  assert.deepEqual([failed.status, failed.notification_id, failed.error_code], ['failed', null, '23503']);
  assert.ok(state.txQueries.some((q) => /^ROLLBACK TO/.test(q)), 'savepoint rolled back');
  assert.equal(state.activity.find((a) => a.student_id === 's3').metadata.delivery, 'failed');
  assert.equal(state.updates.length, 2, 'reminder_sent_at only for delivered assignment reminders');
  const retry = await svc.previewReminders(OWNER, 'assignment', 'a1', { studentIds: ['s3'], now: NOW });
  assert.deepEqual(retry.recipients.map((x) => x.student_id), ['s3'], 'a failed delivery does not start the cooldown');
});

test('exam reminders go to students who have not started; closed exams remind nobody', async () => {
  resetState();
  const p = await svc.previewReminders(OWNER, 'exam', 'e1', { now: NOW });
  assert.deepEqual(p.recipients.map((r) => r.student_id).sort(), ['s2', 's3']);
  assert.deepEqual(p.not_eligible.map((r) => r.student_id).sort(), ['s1', 's4'], 'in progress and expired_no_answers excluded');
  const sent = await svc.sendReminders(OWNER, 'exam', 'e1', { now: NOW });
  assert.equal(sent.sent, 2);
  assert.ok(state.notifications.every((n) => n.type === 'exam_reminder' && n.meta.href === '/student/exams'));
  assert.ok(state.reminderLog.every((l) => l.entity_type === 'exam'));

  const closed = await svc.previewReminders(OWNER, 'exam', 'e2', { now: NOW });
  assert.equal(closed.closed, true);
  assert.equal(closed.recipients.length, 0);
});

test('another workspace cannot preview, send or read a timeline', async () => {
  resetState();
  await assert.rejects(svc.previewReminders(OTHER, 'assignment', 'a1', { now: NOW }), (e) => e.statusCode === 404);
  await assert.rejects(svc.sendReminders(OTHER, 'exam', 'e1', { now: NOW }), (e) => e.statusCode === 404);
  await assert.rejects(svc.getStudentTimeline(OTHER, 'assignment', 'a1', 's2'), (e) => e.statusCode === 404);
  assert.equal(state.notifications.length, 0);
});

test('timeline for the owner returns sanitized events only', async () => {
  const t = await svc.getStudentTimeline(OWNER, 'exam', 'e1', 's1');
  assert.deepEqual(t.events.map((e) => e.event_type), ['exam_started', 'reminder_sent']);
  assert.deepEqual(t.events[0].details, {}, 'answers stripped');
  assert.deepEqual(t.events[1].details, { delivery: 'delivered' });
  assert.equal(t.truncated, false);
});
