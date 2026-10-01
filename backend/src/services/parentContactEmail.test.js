const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Owner decision: optional "Valideyn emaili" on the student profile. Teacher (active enrollment) or
 * admin edits it; the parent result summary goes to the linked parent account and/or this address,
 * deduped when identical, with a one-click unsubscribe for the address. No address/token in logs.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-parent-email';

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const state = { handlers: [], queries: [], notifications: [], queued: [] };

function q(sql, params = []) {
  const flat = sql.replace(/\s+/g, ' ').trim();
  state.queries.push({ sql: flat, params });
  for (const [re, fn] of state.handlers) if (re.test(flat)) return fn(params, flat);
  throw new Error(`unexpected SQL: ${flat.slice(0, 100)}`);
}
const fakeDb = { query: async (sql, params) => q(sql, params), transaction: async (fn) => fn(fakeDb) };
function stub(rel, exports) {
  const id = require.resolve(rel);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
stub('../utils/db', fakeDb);
stub('./notificationService', {
  createNotificationSafe: async (input) => {
    state.notifications.push(input);
    return { created: true };
  },
});
stub('./notificationQueueService', {
  enqueueNotification: async (row) => {
    state.queued.push(row);
  },
  isNotificationRow: (row) => Boolean(row && row.template_key),
});

function reset(handlers = []) {
  state.handlers = handlers;
  state.queries = [];
  state.notifications = [];
  state.queued = [];
}

function captureLogs() {
  const lines = [];
  const orig = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  for (const k of Object.keys(orig)) console[k] = (...a) => lines.push(a.map(String).join(' '));
  return {
    lines,
    restore() {
      Object.assign(console, orig);
    },
  };
}

const svc = require('./parentContactEmailService');
const unsub = require('./emailUnsubscribe');
const { patchStudentParentEmail, canonicalStudentEmail } = require('../controllers/studentEmailController');

function resMock() {
  return {
    statusCode: 200,
    body: null,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
}

test('delivery plan: account and/or contact address, deduped case-insensitively, opt-out respected', () => {
  const plan = svc.planParentResultDelivery;
  assert.deepEqual(plan({ parentAccountId: U(1), parentAccountEmail: 'Ana@Mail.az', parentEmail: ' ana@mail.az ' }), {
    account: true,
    contact: false,
  });
  assert.deepEqual(plan({ parentAccountId: U(1), parentAccountEmail: 'ana@mail.az', parentEmail: 'ata@mail.az' }), {
    account: true,
    contact: true,
  });
  assert.deepEqual(plan({ parentAccountId: null, parentEmail: 'ata@mail.az' }), { account: false, contact: true });
  assert.deepEqual(plan({ parentAccountId: null, parentEmail: 'ata@mail.az', parentEmailOptedOut: true }), {
    account: false,
    contact: false,
  });
  assert.deepEqual(plan({ parentAccountId: U(1), parentAccountEmail: 'a@b.az', parentEmail: '' }), {
    account: true,
    contact: false,
  });
});

test('PATCH parent-email: teacher needs an active enrollment, admin may edit, validation is server-side', async () => {
  let enrolled = false;
  let profileExists = false;
  reset([
    [/FROM enrollments e/, () => ({ rows: enrolled ? [{ '?column?': 1 }] : [] })],
    [/SELECT id, role FROM users/, () => ({ rows: [{ id: U(2), role: 'student' }] })],
    [/^UPDATE student_profiles/, (p) => ({ rows: profileExists ? [{ parent_email: p[1] }] : [] })],
    [/^INSERT INTO student_profiles/, () => ({ rows: [] })],
  ]);

  const teacher = { id: U(9), role: 'instructor' };
  let res = resMock();
  await patchStudentParentEmail({ params: { id: U(2) }, body: { parent_email: 'ata@mail.az' }, user: teacher }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(state.queries.some((x) => /student_profiles/.test(x.sql)), false);

  enrolled = true;
  res = resMock();
  await patchStudentParentEmail({ params: { id: U(2) }, body: { parent_email: 'not-an-email' }, user: teacher }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'INVALID_PARENT_EMAIL');

  res = resMock();
  await patchStudentParentEmail({ params: { id: U(2) }, body: {}, user: teacher }, res);
  assert.equal(res.statusCode, 400);

  reset(state.handlers);
  res = resMock();
  await patchStudentParentEmail({ params: { id: U(2) }, body: { parent_email: ' Ata@Mail.AZ ' }, user: teacher }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.parent_email, 'ata@mail.az');
  const upd = state.queries.find((x) => /^UPDATE student_profiles/.test(x.sql));
  assert.match(upd.sql, /parent_email IS NOT DISTINCT FROM \$2 THEN parent_email_opt_out_at ELSE NULL/);
  assert.ok(state.queries.some((x) => /^INSERT INTO student_profiles/.test(x.sql)), 'creates the profile row when missing');

  reset(state.handlers);
  profileExists = true;
  res = resMock();
  await patchStudentParentEmail({ params: { id: U(2) }, body: { parent_email: null }, user: { id: U(1), role: 'admin' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.parent_email, null);
  assert.equal(state.queries.some((x) => /FROM enrollments/.test(x.sql)), false, 'admin skips the enrollment check');
  assert.equal(canonicalStudentEmail('a'.repeat(250) + '@x.az'), null, 'max 254 chars');
});

test('result summary: account notification + separate contact email; same address is sent once', async () => {
  const examService = require('./examService');
  let row = {
    title: 'Riyaziyyat',
    notify_students: true,
    notify_enabled: true,
    instructor_id: U(9),
    student_name: 'Aysel',
    student_locale: 'en',
    parent_id: U(5),
    parent_account_email: 'ana@mail.az',
    parent_email: 'ata@mail.az',
    parent_email_opt_out_at: null,
  };
  reset([[/FROM exams e/, () => ({ rows: [row] })]]);
  await examService.notifyParentExamResultAfterSubmit(U(7), U(2));
  assert.equal(state.notifications.length, 1);
  assert.equal(state.notifications[0].recipientId, U(5));
  assert.equal(state.queued.length, 1);
  const qrow = state.queued[0];
  assert.equal(qrow.event_type, 'parent_result_contact');
  assert.equal(qrow.to_addr, 'ata@mail.az');
  assert.equal(qrow.unique_key, `parent_result_contact:${U(7)}:${U(2)}`);
  assert.deepEqual(qrow.context.params, { studentName: 'Aysel', examTitle: 'Riyaziyyat' });
  assert.equal(JSON.stringify(qrow).includes('token'), false, 'no unsubscribe token stored in the queue');

  row = { ...row, parent_email: 'ANA@mail.az' };
  reset([[/FROM exams e/, () => ({ rows: [row] })]]);
  await examService.notifyParentExamResultAfterSubmit(U(7), U(2));
  assert.equal(state.notifications.length, 1);
  assert.equal(state.queued.length, 0, 'deduped: same address as the parent account');

  row = { ...row, parent_id: null, parent_account_email: null, parent_email: 'ata@mail.az' };
  reset([[/FROM exams e/, () => ({ rows: [row] })]]);
  await examService.notifyParentExamResultAfterSubmit(U(7), U(2));
  assert.equal(state.notifications.length, 0);
  assert.equal(state.queued.length, 1, 'no parent account: the contact address still gets the summary');

  row = { ...row, parent_email_opt_out_at: new Date() };
  reset([[/FROM exams e/, () => ({ rows: [row] })]]);
  await examService.notifyParentExamResultAfterSubmit(U(7), U(2));
  assert.equal(state.queued.length, 0, 'unsubscribed address is skipped');
});

test('parent unsubscribe token: scoped to student + exact address, never valid as a category token', async () => {
  const token = unsub.createParentEmailUnsubscribeToken(U(2), 'Ata@Mail.az');
  assert.ok(token);
  assert.equal(token.includes('ata@mail.az'), false, 'address is not readable from the token');
  assert.deepEqual(unsub.verifyParentEmailUnsubscribeToken(token), {
    studentId: U(2),
    digest: unsub.parentEmailDigest('ata@mail.az'),
  });
  assert.equal(unsub.verifyUnsubscribeToken(token), null);
  assert.equal(unsub.verifyParentEmailUnsubscribeToken(unsub.createUnsubscribeToken(U(2), 'parent')), null);
  assert.equal(unsub.verifyParentEmailUnsubscribeToken(`${token.split('.')[0]}.AAAA`), null);

  let current = 'other@mail.az';
  reset([
    [/SELECT parent_email FROM student_profiles/, () => ({ rows: [{ parent_email: current }] })],
    [/^UPDATE student_profiles SET parent_email_opt_out_at/, () => ({ rows: [] })],
  ]);
  assert.deepEqual(await unsub.applyUnsubscribe(token), { ok: false, code: 'INVALID_TOKEN' }, 'address changed since');
  assert.equal(state.queries.some((x) => /^UPDATE/.test(x.sql)), false);

  current = 'ata@mail.az';
  assert.deepEqual(await unsub.applyUnsubscribe(token), { ok: true, category: 'parent' });
  assert.ok(state.queries.some((x) => /^UPDATE student_profiles SET parent_email_opt_out_at/.test(x.sql)));
});

test('worker: renders with an unsubscribe link, re-checks the address, and logs neither address nor token', async () => {
  const row = {
    id: U(40),
    channel: 'email',
    event_type: 'parent_result_contact',
    unique_key: `parent_result_contact:${U(7)}:${U(2)}`,
    to_addr: 'ata@mail.az',
    context: { kind: 'parent_contact', student_id: U(2), exam_id: U(7), locale: 'az', params: { studentName: 'Aysel', examTitle: 'Riyaziyyat' } },
  };
  assert.equal(svc.isParentContactRow(row), true);
  let profile = { parent_email: 'ata@mail.az', parent_email_opt_out_at: null };
  const sent = [];
  const deps = {
    query: async () => ({ rows: profile ? [profile] : [] }),
    sendMail: async (msg) => {
      sent.push(msg);
      return { status: 'dry_run' };
    },
  };
  const logs = captureLogs();
  let out;
  try {
    out = await svc.processParentContactEmail(row, deps);
  } finally {
    logs.restore();
  }
  assert.equal(out.kind, 'dry_run');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].stream, 'notification', 'follows EMAIL_ENABLED / EMAIL_DRY_RUN like other notifications');
  assert.equal(sent[0].to, 'ata@mail.az');
  assert.match(sent[0].text, /Aysel/);
  assert.match(sent[0].text, /unsubscribe\?token=/);
  const token = decodeURIComponent(sent[0].text.match(/unsubscribe\?token=([^\s)"]+)/)[1]);
  assert.ok(unsub.verifyParentEmailUnsubscribeToken(token));
  const joined = logs.lines.join('\n');
  assert.equal(joined.includes('ata@mail.az'), false);
  assert.equal(joined.includes(token), false);

  profile = { parent_email: 'yeni@mail.az', parent_email_opt_out_at: null };
  assert.equal((await svc.processParentContactEmail(row, deps)).kind, 'skipped');
  profile = { parent_email: 'ata@mail.az', parent_email_opt_out_at: new Date() };
  assert.equal((await svc.processParentContactEmail(row, deps)).kind, 'suppressed');
  assert.equal(sent.length, 1);
});
