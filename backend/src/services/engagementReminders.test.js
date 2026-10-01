const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Əl ilə xatırlatma: önizləmə heç nə yazmır, soyuma müddəti (6 saat) təkrarı bloklayır, eyni anda iki klik
 * ikiqat xatırlatma yaratmır, çatdırılma nəticəsi (sent/failed) və REMINDER_SENT yazılır, imtahan qaydaları.
 * Çatdırılma notificationService üzərindən çağıranın tranzaksiyasındadır: rollback → nə bildiriş, nə email;
 * commit → hər ikisi.
 * DB yoxdur: sorğular yaddaşdakı cədvəllərə yazan saxta client ilə əvəzlənir (tranzaksiya + savepoint semantikası ilə).
 */

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const OWNER = U(901);
const OTHER = U(902);
const A1 = U(101);
const E1 = U(201);
const E2 = U(202);
const [S1, S2, S3, S4] = [U(1), U(2), U(3), U(4)];
const NOW = new Date('2026-10-01T10:00:00Z');

const ASSIGNMENTS = [{ id: A1, instructor_id: OWNER, title: 'Faiz məsələləri', due_date: '2026-10-05', created_at: NOW, group_name: '7A' }];
const ASSIGNMENT_ROWS = [
  { student_assignment_id: U(11), assignment_id: A1, student_id: S1, full_name: 'Aysel', status: 'submitted', submitted_at: '2026-09-30T10:00:00Z' },
  { student_assignment_id: U(12), assignment_id: A1, student_id: S2, full_name: 'Babək', status: 'pending' },
  { student_assignment_id: U(13), assignment_id: A1, student_id: S3, full_name: 'Cavid', status: 'pending', first_opened_at: '2026-09-30T09:00:00Z' },
  { student_assignment_id: U(14), assignment_id: A1, student_id: S4, full_name: 'Dilarə', status: 'returned', returned_at: '2026-09-30T11:00:00Z' },
];
const EXAMS = [
  { id: E1, instructor_id: OWNER, title: 'Riyaziyyat KSQ 1', max_points: '10', created_at: NOW, available_until: '2026-10-02T10:00:00Z' },
  { id: E2, instructor_id: OWNER, title: 'Bağlı imtahan', max_points: '10', created_at: NOW, available_until: '2026-09-30T10:00:00Z' },
];
const EXAM_ROSTER = [
  { exam_id: E1, student_id: S1, full_name: 'Aysel', status: 'in_progress', started_at: '2026-10-01T09:55:00Z', latest_activity_at: '2026-10-01T09:58:00Z', result_status: 'in_progress' },
  { exam_id: E1, student_id: S2, full_name: 'Babək', status: 'viewed', viewed_at: '2026-10-01T07:00:00Z' },
  { exam_id: E1, student_id: S3, full_name: 'Cavid' },
  { exam_id: E1, student_id: S4, full_name: 'Dilarə', status: 'expired_no_answers', started_at: '2026-10-01T08:00:00Z', expired_at: '2026-10-01T08:30:00Z', result_status: 'expired' },
  { exam_id: E2, student_id: S3, full_name: 'Cavid' },
];
const LOCALES = { [S2]: 'en', [S3]: 'az', [S4]: 'ru' };

const TABLES = ['notifications', 'outbox', 'reminderLog', 'activity', 'updates'];
const state = {};
function resetState() {
  for (const t of TABLES) state[t] = [];
  state.txQueries = [];
  state.failFor = new Set();
  state.failReminderLogFor = new Set();
  state.writesOutsideTx = 0;
  state.commits = 0;
  state.rollbacks = 0;
}
resetState();

const owned = (list, owner, ids) => list.filter((x) => x.instructor_id === owner && (!ids || ids.includes(x.id)));

function readQuery(sql, params, view = state) {
  if (/^\s*(INSERT|UPDATE|DELETE)/i.test(sql)) state.writesOutsideTx += 1;
  if (/exam_group_names/.test(sql)) return { rows: [] };
  if (/reminder_locales/.test(sql)) return { rows: params[0].map((id) => ({ id, locale: LOCALES[id] || null })) };
  if (/SELECT id, role, locale, is_active, deleted_at FROM users/.test(sql)) {
    return { rows: [{ id: params[0], role: 'student', locale: LOCALES[params[0]] || null, is_active: true, deleted_at: null }] };
  }
  if (/FROM notification_preferences/.test(sql)) return { rows: [] };
  if (/reminder_recent/.test(sql)) {
    const [entityType, entityId, ids, nowIso, hours] = params;
    const since = new Date(nowIso).getTime() - hours * 3600000;
    const last = new Map();
    for (const r of view.reminderLog) {
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
  const tx = Object.fromEntries(TABLES.map((t) => [t, []]));
  const savepoints = [];
  const view = () => Object.fromEntries(TABLES.map((t) => [t, [...state[t], ...tx[t]]]));
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
      let m = /^\s*SAVEPOINT (\w+)/.exec(sql);
      if (m) {
        savepoints.push({ name: m[1], lengths: Object.fromEntries(TABLES.map((t) => [t, tx[t].length])) });
        return { rows: [] };
      }
      m = /^\s*ROLLBACK TO SAVEPOINT (\w+)/.exec(sql);
      if (m) {
        const sp = [...savepoints].reverse().find((s) => s.name === m[1]);
        for (const t of TABLES) tx[t].length = sp.lengths[t];
        return { rows: [] };
      }
      m = /^\s*RELEASE SAVEPOINT (\w+)/.exec(sql);
      if (m) {
        const idx = savepoints.map((s) => s.name).lastIndexOf(m[1]);
        savepoints.length = idx;
        return { rows: [] };
      }
      if (/INSERT INTO notifications/.test(sql)) {
        if (state.failFor.has(params[0])) {
          const err = new Error('boom');
          err.code = '23503';
          throw err;
        }
        const [userId, title, body, type, , metaJson, category, priority, relType, relId] = params;
        const dedupeKey = params[14];
        const enqueueOutbox = params[16];
        const id = params[17];
        if (dedupeKey && view().notifications.some((n) => n.user_id === userId && n.dedupe_key === dedupeKey)) return { rows: [] };
        tx.notifications.push({
          id,
          user_id: userId,
          title,
          body,
          type,
          meta: JSON.parse(metaJson),
          category,
          priority,
          related_entity_type: relType,
          related_entity_id: relId,
          dedupe_key: dedupeKey,
          email_status: params[13],
        });
        if (enqueueOutbox) tx.outbox.push({ unique_key: `email:notification:${id}`, notification_id: id, user_id: userId, template_key: type });
        return { rows: [{ id, queued: enqueueOutbox ? 1 : 0, legacy_queued: 0 }] };
      }
      if (/INSERT INTO reminder_log/.test(sql)) {
        const skipped = /'skipped_recent'/.test(sql);
        if (!skipped && state.failReminderLogFor.has(params[3])) {
          const err = new Error('reminder_log write failed');
          err.code = '57014';
          throw err;
        }
        tx.reminderLog.push(
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
        tx.activity.push({ student_id: params[0], entity_type: params[2], entity_id: params[3], event_type: params[4], metadata: JSON.parse(params[5]), dedupe_key: params[7] });
        return { rows: [{ id: state.activity.length + tx.activity.length }] };
      }
      if (/UPDATE student_assignments/.test(sql)) {
        tx.updates.push(params);
        return { rows: [] };
      }
      return readQuery(sql, params, view());
    },
    commit() {
      for (const t of TABLES) state[t].push(...tx[t]);
      state.commits += 1;
    },
    rollback() {
      state.rollbacks += 1;
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
        const out = await cb(client);
        client.commit();
        return out;
      } catch (err) {
        client.rollback();
        throw err;
      } finally {
        client.end();
      }
    },
  },
};

const svc = require('./engagementService');

const ENV_KEYS = ['EMAIL_ENABLED', 'EMAIL_DRY_RUN', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
function withEmailDryRun(fn) {
  return async () => {
    const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    for (const k of ENV_KEYS) delete process.env[k];
    process.env.EMAIL_ENABLED = 'true';
    try {
      await fn();
    } finally {
      for (const k of ENV_KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    }
  };
}

test('preview lists recipients, cooldown and message without writing anything', async () => {
  resetState();
  const p = await svc.previewReminders(OWNER, 'assignment', A1, { now: NOW });
  assert.deepEqual(p.recipients.map((r) => r.student_id).sort(), [S2, S3, S4], 'not-submitted (incl. returned) only');
  assert.deepEqual(p.not_eligible.map((r) => r.student_id), [S1]);
  assert.equal(p.counts.recipients, 3);
  assert.equal(p.cooldown_hours, svc.REMINDER_COOLDOWN_HOURS);
  assert.deepEqual(p.messages.map((m) => [m.locale, m.count]), [['az', 1], ['en', 1], ['ru', 1]]);
  assert.match(p.messages.find((m) => m.locale === 'az').body, /«Faiz məsələləri» tapşırığını/);
  assert.equal(state.writesOutsideTx, 0);
  assert.equal(state.txQueries.length, 0, 'no transaction opened by a preview');
});

test('send: one notification per recipient through the service, logged with delivery outcome and REMINDER_SENT', async () => {
  resetState();
  const r = await svc.sendReminders(OWNER, 'assignment', A1, { studentIds: [S2, S3, S1], now: NOW });
  assert.equal(r.sent, 2);
  assert.equal(r.not_eligible, 1, 's1 already submitted');
  assert.equal(r.failed, 0);
  assert.ok(r.batch_id);
  const byStudent = (a, b) => String(a[0]).localeCompare(String(b[0]));
  assert.deepEqual(state.notifications.map((n) => [n.user_id, n.type]).sort(byStudent), [[S2, 'assignment_reminder'], [S3, 'assignment_reminder']]);
  const toS2 = state.notifications.find((n) => n.user_id === S2);
  assert.equal(toS2.title, 'Reminder', 's2 prefers English');
  assert.equal(toS2.meta.assignment_id, A1);
  assert.equal(toS2.meta.reminder_kind, 'manual');
  assert.deepEqual([toS2.category, toS2.related_entity_type, toS2.related_entity_id], ['assignment', 'assignment', A1]);
  assert.equal(toS2.dedupe_key, `reminder:assignment:${A1}:${r.batch_id}`);
  assert.deepEqual(
    state.reminderLog
      .map((l) => [l.student_id, l.status, state.notifications.find((n) => n.user_id === l.student_id).id === l.notification_id, l.batch_id === r.batch_id])
      .sort(byStudent),
    [[S2, 'sent', true, true], [S3, 'sent', true, true]],
  );
  assert.ok(state.reminderLog.every((l) => l.message_preview && !/\d+ bal/.test(l.message_preview)));
  assert.deepEqual(
    state.activity.map((a) => [a.student_id, a.event_type, a.metadata.delivery]).sort(byStudent),
    [[S2, 'reminder_sent', 'delivered'], [S3, 'reminder_sent', 'delivered']],
  );
  const lockAt = state.txQueries.findIndex((q) => /pg_advisory_xact_lock/.test(q));
  const recentAt = state.txQueries.findIndex((q) => /reminder_recent/.test(q));
  assert.ok(lockAt >= 0 && recentAt > lockAt, 'cooldown is re-checked after taking the lock');
});

test('D20: a manual assignment reminder does not touch reminder_sent_at (the automatic 24h reminder stays armed)', async () => {
  resetState();
  const r = await svc.sendReminders(OWNER, 'assignment', A1, { now: NOW });
  assert.equal(r.sent, 3);
  assert.equal(state.updates.length, 0, 'student_assignments.reminder_sent_at is auto-only');
});

test('commit: notification and its email outbox row are both persisted', withEmailDryRun(async () => {
  resetState();
  const r = await svc.sendReminders(OWNER, 'assignment', A1, { studentIds: [S2, S3], now: NOW });
  assert.equal(r.sent, 2);
  assert.equal(state.commits, 1);
  assert.equal(state.notifications.length, 2);
  assert.equal(state.outbox.length, 2, 'one email per notification, same transaction');
  assert.deepEqual(
    state.outbox.map((o) => o.unique_key).sort(),
    state.notifications.map((n) => `email:notification:${n.id}`).sort(),
  );
  assert.ok(state.notifications.every((n) => n.email_status === 'queued'));
}));

test('rollback: a failure later in the transaction leaves no notification and no email behind', withEmailDryRun(async () => {
  resetState();
  state.failReminderLogFor.add(S3);
  await assert.rejects(svc.sendReminders(OWNER, 'assignment', A1, { studentIds: [S2, S3], now: NOW }), (e) => e.code === '57014');
  assert.equal(state.rollbacks, 1);
  assert.equal(state.commits, 0);
  assert.equal(state.notifications.length, 0, 'S2 notification was written in the rolled-back transaction');
  assert.equal(state.outbox.length, 0, 'no orphan email');
  assert.equal(state.reminderLog.length, 0);
  assert.equal(state.activity.length, 0);

  state.failReminderLogFor.clear();
  const retry = await svc.sendReminders(OWNER, 'assignment', A1, { studentIds: [S2, S3], now: NOW });
  assert.equal(retry.sent, 2, 'nothing from the failed attempt starts the cooldown');
  assert.equal(state.outbox.length, 2);
}));

test('duplicate reminder within the cooldown is skipped, not re-sent', async () => {
  resetState();
  await svc.sendReminders(OWNER, 'assignment', A1, { studentIds: [S2], now: NOW });
  const again = await svc.sendReminders(OWNER, 'assignment', A1, { studentIds: [S2], now: new Date(NOW.getTime() + 3600000) });
  assert.equal(again.sent, 0);
  assert.equal(again.skipped_recent, 1);
  assert.equal(state.notifications.length, 1);
  const preview = await svc.previewReminders(OWNER, 'assignment', A1, { studentIds: [S2], now: NOW });
  assert.deepEqual(preview.recently_reminded.map((r) => r.student_id), [S2]);
  assert.equal(preview.recipients.length, 0);
  const later = await svc.sendReminders(OWNER, 'assignment', A1, { studentIds: [S2], now: new Date(NOW.getTime() + 7 * 3600000) });
  assert.equal(later.sent, 1, 'allowed again after 6 hours');
});

test('double click: two concurrent sends produce one notification per student', async () => {
  resetState();
  const [a, b] = await Promise.all([
    svc.sendReminders(OWNER, 'assignment', A1, { now: NOW }),
    svc.sendReminders(OWNER, 'assignment', A1, { now: NOW }),
  ]);
  assert.equal(a.sent + b.sent, 3);
  assert.equal(a.skipped_recent + b.skipped_recent, 3);
  assert.equal(state.notifications.length, 3);
  assert.equal(new Set(state.notifications.map((n) => n.user_id)).size, 3);
});

test('a failed delivery is recorded as failed and does not block the others', async () => {
  resetState();
  state.failFor.add(S3);
  const r = await svc.sendReminders(OWNER, 'assignment', A1, { now: NOW });
  assert.equal(r.sent, 2);
  assert.equal(r.failed, 1);
  const failed = state.reminderLog.find((l) => l.student_id === S3);
  assert.deepEqual([failed.status, failed.notification_id, failed.error_code], ['failed', null, '23503']);
  assert.ok(state.txQueries.some((q) => /^ROLLBACK TO/.test(q)), 'savepoint rolled back');
  assert.equal(state.activity.find((a) => a.student_id === S3).metadata.delivery, 'failed');
  assert.equal(state.notifications.length, 2);
  const retry = await svc.previewReminders(OWNER, 'assignment', A1, { studentIds: [S3], now: NOW });
  assert.deepEqual(retry.recipients.map((x) => x.student_id), [S3], 'a failed delivery does not start the cooldown');
});

test('exam reminders go to students who have not started; closed exams remind nobody', async () => {
  resetState();
  const p = await svc.previewReminders(OWNER, 'exam', E1, { now: NOW });
  assert.deepEqual(p.recipients.map((r) => r.student_id).sort(), [S2, S3]);
  assert.deepEqual(p.not_eligible.map((r) => r.student_id).sort(), [S1, S4], 'in progress and expired_no_answers excluded');
  const sent = await svc.sendReminders(OWNER, 'exam', E1, { now: NOW });
  assert.equal(sent.sent, 2);
  assert.ok(state.notifications.every((n) => n.type === 'exam_reminder' && n.meta.href === '/student/exams' && n.category === 'assessment'));
  assert.ok(state.reminderLog.every((l) => l.entity_type === 'exam'));

  const closed = await svc.previewReminders(OWNER, 'exam', E2, { now: NOW });
  assert.equal(closed.closed, true);
  assert.equal(closed.recipients.length, 0);
});

test('another workspace cannot preview, send or read a timeline', async () => {
  resetState();
  await assert.rejects(svc.previewReminders(OTHER, 'assignment', A1, { now: NOW }), (e) => e.statusCode === 404);
  await assert.rejects(svc.sendReminders(OTHER, 'exam', E1, { now: NOW }), (e) => e.statusCode === 404);
  await assert.rejects(svc.getStudentTimeline(OTHER, 'assignment', A1, S2), (e) => e.statusCode === 404);
  assert.equal(state.notifications.length, 0);
});

test('timeline for the owner returns sanitized events only', async () => {
  const t = await svc.getStudentTimeline(OWNER, 'exam', E1, S1);
  assert.deepEqual(t.events.map((e) => e.event_type), ['exam_started', 'reminder_sent']);
  assert.deepEqual(t.events[0].details, {}, 'answers stripped');
  assert.deepEqual(t.events[1].details, { delivery: 'delivered' });
  assert.equal(t.truncated, false);
});
