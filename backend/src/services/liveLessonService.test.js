const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Live lessons on teacher-supplied Meet/Zoom links: validation, recurrence, link visibility, access
 * control and the notification triggers (create / update / cancel / reminder). DB + notifications stubbed.
 */

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TEACHER = U(1);
const OTHER_TEACHER = U(2);
const STUDENT_A = U(10);
const STUDENT_B = U(11);
const OUTSIDER = U(12);
const PARENT = U(20);
const GROUP = U(50);
const ROOM = U(70);

const state = { rooms: new Map(), calls: [], queries: [], roster: [STUDENT_A, STUDENT_B], visible: new Set([STUDENT_A, STUDENT_B]) };

function baseRoom(extra = {}) {
  const start = new Date(Date.now() + 3 * 3600 * 1000);
  return {
    id: ROOM,
    room_code: 'MX-ABC234',
    instructor_id: TEACHER,
    instructor_name: 'Aynur Məmmədova',
    group_id: GROUP,
    group_name: '11-A',
    student_id: null,
    title: 'Riyaziyyat',
    description: 'Törəmə',
    status: 'waiting',
    scheduled_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 60 * 60000).toISOString(),
    duration_minutes: 60,
    provider: 'google_meet',
    join_url: 'https://meet.google.com/abc-defg-hij',
    start_url: null,
    passcode: 'SECRET-PASS',
    provider_payload: { token: 'x' },
    reminder_offset_minutes: 60,
    notify_email: true,
    series_id: null,
    materials: [],
    updated_at: new Date().toISOString(),
    cancelled_at: null,
    ...extra,
  };
}

const dbId = require.resolve('../utils/db');
const fakeDb = {
  query: async (sql, params = []) => {
    state.queries.push(sql);
    if (/SELECT 1 FROM live_rooms lr WHERE lr\.id = \$2/.test(sql)) {
      return { rows: state.visible.has(params[0]) ? [{ '?column?': 1 }] : [] };
    }
    if (/SELECT DISTINCT e\.student_id FROM enrollments e/.test(sql)) {
      return { rows: state.roster.map((student_id) => ({ student_id })) };
    }
    if (/FROM live_rooms lr\s+JOIN users u ON u\.id = lr\.instructor_id/.test(sql) && /WHERE lr\.id = \$1/.test(sql)) {
      const r = state.rooms.get(params[0]);
      return { rows: r ? [r] : [] };
    }
    if (/SELECT full_name FROM users/.test(sql)) return { rows: [{ full_name: 'Aynur Məmmədova' }] };
    if (/FROM live_lesson_attendance WHERE room_id = \$1 AND student_id = \$2/.test(sql)) return { rows: [] };
    if (/^\s*UPDATE live_rooms SET\s+title/.test(sql)) {
      const cur = state.rooms.get(params[0]);
      const next = {
        ...cur,
        title: params[1] ?? cur.title,
        scheduled_at: params[7].toISOString(),
        duration_minutes: params[8],
        ends_at: params[9].toISOString(),
        join_url: params[11] ?? cur.join_url,
        updated_at: new Date(Date.now() + 1000).toISOString(),
      };
      state.rooms.set(cur.id, next);
      return { rows: [next] };
    }
    if (/UPDATE live_rooms SET status = 'cancelled'/.test(sql)) {
      const cur = state.rooms.get(params[0]);
      const next = { ...cur, status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: params[2] };
      state.rooms.set(cur.id, next);
      return { rows: [next] };
    }
    if (/UPDATE live_rooms lr SET reminder_sent_at = NOW\(\)/.test(sql)) {
      return { rows: [...state.rooms.values()].filter((r) => !r.reminder_sent_at) };
    }
    throw new Error(`unexpected SQL: ${sql.slice(0, 80)}`);
  },
  transaction: async (fn) => fn(fakeDb),
};
require.cache[dbId] = { id: dbId, filename: dbId, loaded: true, exports: fakeDb };

const nsId = require.resolve('./notificationService');
require.cache[nsId] = {
  id: nsId,
  filename: nsId,
  loaded: true,
  exports: {
    createNotificationSafe: async (input) => {
      state.calls.push(input);
      return { created: true, id: U(900 + state.calls.length) };
    },
  },
};

const svc = require('./liveLessonService');

function reset(roomExtra = {}) {
  state.rooms = new Map([[ROOM, baseRoom(roomExtra)]]);
  state.calls = [];
  state.queries = [];
  state.roster = [STUDENT_A, STUDENT_B];
  state.visible = new Set([STUDENT_A, STUDENT_B]);
}

const future = () => new Date(Date.now() + 26 * 3600 * 1000);
const ymd = (d) => new Date(d.getTime() + 4 * 3600 * 1000).toISOString().slice(0, 10);

function validBody(extra = {}) {
  return {
    title: 'Fizika',
    group_id: GROUP,
    date: ymd(future()),
    start_time: '18:00',
    end_time: '19:30',
    platform: 'google_meet',
    meeting_url: 'https://meet.google.com/abc-defg-hij',
    reminder_offset_minutes: 30,
    ...extra,
  };
}

/* ------------------------------------------------------------- validation */

test('teacher can create a lesson: form is validated and normalised (Baku time)', () => {
  const v = svc.validateLessonInput(validBody());
  assert.equal(v.title, 'Fizika');
  assert.equal(v.group_id, GROUP);
  assert.equal(v.student_id, null);
  assert.equal(v.duration_minutes, 90);
  assert.equal(v.provider, 'google_meet');
  assert.equal(v.join_url, 'https://meet.google.com/abc-defg-hij');
  assert.equal(v.reminder_offset_minutes, 30);
  assert.equal(v.notify_email, true);
  assert.equal(v.scheduled_at.toISOString().slice(11, 16), '14:00');
  assert.deepEqual(v.recurrence, { type: 'none' });
});

test('Zoom lesson with duration instead of end time', () => {
  const v = svc.validateLessonInput(
    validBody({ end_time: undefined, duration_minutes: 45, platform: 'zoom', meeting_url: 'https://zoom.us/j/1234567890' }),
  );
  assert.equal(v.provider, 'zoom');
  assert.equal(v.duration_minutes, 45);
});

test('validation errors are field-specific and in Azerbaijani', () => {
  const cases = [
    [{ title: '' }, 'title', /adını/],
    [{ group_id: null }, 'target', /Qrup və ya fərdi tələbə/],
    [{ student_id: STUDENT_A }, 'target', /ikisi birlikdə yox/],
    [{ end_time: '17:00' }, 'ends_at', /sonra/],
    [{ date: '2020-01-01' }, 'starts_at', /Keçmiş/],
    [{ meeting_url: 'http://meet.google.com/abc-defg-hij' }, 'meeting_url', /https/],
    [{ platform: 'zoom' }, 'meeting_url', /Google Meet/],
    [{ reminder_offset_minutes: 5 }, 'reminder_offset_minutes', /Xatırlatma/],
    [{ materials: [{ title: 'x', url: 'javascript:alert(1)' }] }, 'materials', /Material linki/],
  ];
  for (const [patch, field, re] of cases) {
    assert.throws(
      () => svc.validateLessonInput(validBody(patch)),
      (e) => e.status === 400 && e.details?.[field] && re.test(e.details[field]),
      field,
    );
  }
});

/* ------------------------------------------------------------- recurrence */

test('recurrence: weekly, weekdays and custom rules keep the Baku wall-clock time', () => {
  const start = svc.bakuLocalToDate('2026-10-05', '18:00').getTime(); // Monday
  const weekly = svc.buildOccurrences(start, svc.normalizeRecurrence({ type: 'weekly', count: 4 }));
  assert.equal(weekly.length, 4);
  assert.equal(weekly[3] - weekly[0], 21 * 24 * 3600 * 1000);

  const weekdays = svc.buildOccurrences(start, svc.normalizeRecurrence({ type: 'weekdays', count: 7 }));
  assert.deepEqual(weekdays.map(svc.bakuIsoWeekday), [1, 2, 3, 4, 5, 1, 2]);

  const custom = svc.buildOccurrences(start, svc.normalizeRecurrence({ type: 'custom', days: [1, 3], interval_weeks: 2, count: 4 }));
  assert.deepEqual(custom.map(svc.bakuIsoWeekday), [1, 3, 1, 3]);
  assert.equal(custom[2] - custom[0], 14 * 24 * 3600 * 1000);

  const until = svc.buildOccurrences(start, svc.normalizeRecurrence({ type: 'weekly', until: '2026-10-20' }));
  assert.equal(until.length, 3);
  for (const t of [...weekly, ...weekdays, ...custom]) {
    assert.equal(new Date(t).toISOString().slice(11, 16), '14:00');
  }
  assert.throws(() => svc.normalizeRecurrence({ type: 'custom', days: [] }), /həftə günü/);
  assert.throws(() => svc.normalizeRecurrence({ type: 'weekly', count: 100 }), /arasında/);
});

/* ------------------------------------------------------------- link visibility */

test('link is shown only when the server-side check allows it; passcode/provider data never leak', () => {
  const row = baseRoom();
  const hidden = svc.mapLesson(row, { canSeeLink: false });
  assert.equal(hidden.join_url, null);
  assert.equal(hidden.can_join, false);
  const shown = svc.mapLesson(row, { canSeeLink: true });
  assert.equal(shown.join_url, 'https://meet.google.com/abc-defg-hij');
  assert.equal(shown.can_join, true);
  for (const out of [hidden, shown]) {
    const json = JSON.stringify(out);
    assert.doesNotMatch(json, /SECRET-PASS|provider_payload|token/);
  }
  const cancelled = svc.mapLesson(baseRoom({ status: 'cancelled', cancelled_at: new Date().toISOString() }), { canSeeLink: true });
  assert.equal(cancelled.join_url, null);
  assert.equal(cancelled.state, 'cancelled');
  const legacy = svc.mapLesson(baseRoom({ provider: 'mentorix_live', join_url: null }), { canSeeLink: true });
  assert.equal(legacy.state, 'legacy');
  assert.equal(legacy.can_join, false);
});

test('display state: upcoming → live (10 min before) → ended', () => {
  const start = Date.now() + 60 * 60000;
  const row = baseRoom({ scheduled_at: new Date(start).toISOString(), ends_at: new Date(start + 3600000).toISOString() });
  assert.equal(svc.lessonDisplayState(row, start - 11 * 60000), 'upcoming');
  assert.equal(svc.lessonDisplayState(row, start - 9 * 60000), 'live');
  assert.equal(svc.lessonDisplayState(row, start + 3600000 + 1), 'ended');
});

/* ------------------------------------------------------------- access control */

test('student sees only their own lesson link; other students, parents and other teachers do not', async () => {
  reset();
  state.visible = new Set([STUDENT_A]);
  const room = state.rooms.get(ROOM);
  assert.equal(await svc.canViewLesson({ id: TEACHER, role: 'instructor' }, room), true);
  assert.equal(await svc.canViewLesson({ id: U(99), role: 'admin' }, room), true);
  assert.equal(await svc.canViewLesson({ id: STUDENT_A, role: 'student' }, room), true);
  assert.equal(await svc.canViewLesson({ id: OUTSIDER, role: 'student' }, room), false);
  assert.equal(await svc.canViewLesson({ id: OTHER_TEACHER, role: 'instructor' }, room), false);
  assert.equal(await svc.canViewLesson({ id: PARENT, role: 'parent' }, room), false);
  assert.equal(await svc.canViewLesson(null, room), false);

  const mine = await svc.getLessonForUser({ id: STUDENT_A, role: 'student' }, { id: ROOM });
  assert.equal(mine.join_url, 'https://meet.google.com/abc-defg-hij');
  assert.equal(mine.is_owner, false);

  for (const user of [
    { id: OUTSIDER, role: 'student' },
    { id: OTHER_TEACHER, role: 'instructor' },
    { id: PARENT, role: 'parent' },
  ]) {
    // eslint-disable-next-line no-await-in-loop
    await assert.rejects(() => svc.getLessonForUser(user, { id: ROOM }), (e) => e.status === 404 && !/meet\.google/.test(e.message));
  }
});

test('student access SQL requires a current enrollment with the teacher and the lesson target', () => {
  const sql = svc.STUDENT_CAN_VIEW_SQL;
  assert.match(sql, /e\.instructor_id = lr\.instructor_id/);
  assert.match(sql, /e\.deleted_at IS NULL/);
  assert.match(sql, /lr\.student_id = \$1/);
  assert.match(sql, /e\.group_id = lr\.group_id/);
});

test('.ics calendar file is RFC 5545 with escaping and folding', () => {
  const ics = svc.buildIcs(baseRoom({ title: 'Riyaziyyat, törəmə; test', description: 'Sətir 1\nSətir 2' }), {
    appUrl: 'https://mentorix.io',
    now: Date.UTC(2026, 9, 1),
  });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /SUMMARY:Riyaziyyat\\, törəmə\\; test\r\n/);
  assert.match(ics, /STATUS:CONFIRMED/);
  assert.match(ics, /URL:https:\/\/meet\.google\.com\/abc-defg-hij/);
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, line);
  const cancelled = svc.buildIcs(baseRoom({ status: 'cancelled' }), {});
  assert.match(cancelled, /STATUS:CANCELLED/);
});

/* ------------------------------------------------------------- notification triggers */

test('changing the time emails the roster (live_lesson_updated, previous time included, no link in params)', async () => {
  reset();
  const cur = state.rooms.get(ROOM);
  const newStart = new Date(new Date(cur.scheduled_at).getTime() + 24 * 3600 * 1000);
  const out = await svc.updateLesson(TEACHER, ROOM, { starts_at: newStart.toISOString() });
  assert.equal(out.notified, true);
  const updated = state.calls.filter((c) => c.eventType === 'live_lesson_updated');
  assert.deepEqual(updated.map((c) => c.recipientId).sort(), [STUDENT_A, STUDENT_B]);
  for (const c of updated) {
    assert.equal(c.category, 'live_lesson');
    assert.equal(c.email, true);
    assert.ok(c.params.previousStartsAt);
    assert.doesNotMatch(JSON.stringify(c.params), /meet\.google\.com/);
    assert.equal(c.meta.href, '/live/MX-ABC234');
  }
});

test('description-only edit does not email', async () => {
  reset();
  const out = await svc.updateLesson(TEACHER, ROOM, { description: 'yeni qeyd' });
  assert.equal(out.notified, false);
  assert.equal(state.calls.length, 0);
});

test('another teacher cannot edit or cancel the lesson', async () => {
  reset();
  await assert.rejects(() => svc.updateLesson(OTHER_TEACHER, ROOM, { title: 'x' }), (e) => e.status === 404);
  await assert.rejects(() => svc.cancelLesson(OTHER_TEACHER, ROOM), (e) => e.status === 404);
  assert.equal(state.calls.length, 0);
});

test('cancelling emails the roster with HIGH priority and the reason', async () => {
  reset();
  const out = await svc.cancelLesson(TEACHER, ROOM, { reason: 'Xəstəyəm' });
  assert.equal(out.cancelled, 1);
  const calls = state.calls.filter((c) => c.eventType === 'live_lesson_cancelled');
  assert.equal(calls.length, 2);
  for (const c of calls) {
    assert.equal(c.priority, 'HIGH');
    assert.equal(c.email, true);
    assert.equal(c.params.reason, 'Xəstəyəm');
  }
});

test('lesson-level "email" toggle off → in-app only', async () => {
  reset({ notify_email: false });
  await svc.cancelLesson(TEACHER, ROOM, {});
  assert.ok(state.calls.length > 0);
  assert.ok(state.calls.every((c) => c.email === false));
});

test('reminder job claims due lessons atomically and notifies once per start time', async () => {
  reset();
  const out = await svc.runLiveLessonReminders();
  assert.equal(out.claimed, 1);
  const sql = state.queries.find((q) => /reminder_sent_at = NOW\(\)/.test(q));
  assert.match(sql, /FOR UPDATE SKIP LOCKED/);
  assert.match(sql, /scheduled_at - make_interval\(mins => reminder_offset_minutes\) <= NOW\(\)/);
  assert.match(sql, /scheduled_at > NOW\(\)/);
  assert.match(sql, /cancelled_at IS NULL/);
  assert.match(sql, /provider <> 'mentorix_live'/);
  const calls = state.calls.filter((c) => c.eventType === 'live_lesson_reminder');
  assert.equal(calls.length, 2);
  const startMs = new Date(state.rooms.get(ROOM).scheduled_at).getTime();
  for (const c of calls) assert.equal(c.dedupeKey, `live_lesson_reminder:${ROOM}:${startMs}`);
});

test('legacy internal-video lessons cannot be edited', async () => {
  reset({ provider: 'mentorix_live', join_url: null });
  await assert.rejects(() => svc.updateLesson(TEACHER, ROOM, { title: 'x' }), (e) => e.status === 409 && e.code === 'LEGACY_LESSON');
});
