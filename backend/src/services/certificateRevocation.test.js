const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * Owner decision: admin-only certificate revoke (required reason, audited before the change), the
 * public verify page shows "revoked" + date but never the reason, the existing status-change email
 * goes out, and a revoked certificate can be reinstated. DB, audit and notifications are stubbed.
 */

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const state = { handlers: [], queries: [], audits: [], notifications: [], auditFails: false };

function q(sql, params = []) {
  const flat = sql.replace(/\s+/g, ' ').trim();
  state.queries.push({ sql: flat, params });
  for (const [re, fn] of state.handlers) if (re.test(flat)) return fn(params, flat);
  throw new Error(`unexpected SQL: ${flat.slice(0, 120)}`);
}
const fakeDb = { query: async (sql, params) => q(sql, params), transaction: async (fn) => fn(fakeDb) };
function stub(rel, exports) {
  const id = require.resolve(rel);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
stub('../utils/db', fakeDb);
stub('./adminAccessAudit', {
  recordAdminAccess: async (input) => {
    if (state.auditFails) throw Object.assign(new Error('audit down'), { statusCode: 503, code: 'ADMIN_AUDIT_UNAVAILABLE' });
    state.audits.push({ ...input, req: undefined, at: state.queries.length });
  },
});
stub('./notificationService', {
  createNotificationSafe: async (input) => {
    state.notifications.push(input);
    return { created: true };
  },
});

function reset(handlers = []) {
  state.handlers = handlers;
  state.queries = [];
  state.audits = [];
  state.notifications = [];
  state.auditFails = false;
}

const { revokeCertificateAdmin, reinstateCertificateAdmin } = require('../controllers/adminCertificateController');
const certificateService = require('./certificateService');

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

const CERT = U(30);
const admin = { id: U(1), role: 'admin' };
const certRow = (status) => ({ id: CERT, student_id: U(2), exam_id: U(7), status, certificate_no: 'MX-2026-000001' });

test('revoke: reason required, only issued certificates, audit written before the change', async () => {
  let status = 'issued';
  reset([
    [/^SELECT id, student_id, exam_id, status, certificate_no FROM certificates/, () => ({ rows: [certRow(status)] })],
    [/^UPDATE certificates SET status = 'revoked'/, () => ({ rows: [{ id: CERT, status: 'revoked', revoked_at: new Date('2026-10-01T08:00:00Z') }] })],
    [/^SELECT id, student_id, instructor_id, title FROM certificates/, () => ({ rows: [{ id: CERT, student_id: U(2), instructor_id: U(9), title: 'Riyaziyyat' }] })],
  ]);

  let res = resMock();
  await revokeCertificateAdmin({ params: { id: CERT }, body: { reason: 'x' }, user: admin }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'REASON_REQUIRED');
  assert.equal(state.audits.length, 0);

  status = 'superseded';
  res = resMock();
  await revokeCertificateAdmin({ params: { id: CERT }, body: { reason: 'Plagiat aşkarlandı' }, user: admin }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(state.audits.length, 0);

  status = 'issued';
  reset(state.handlers);
  state.auditFails = true;
  res = resMock();
  await revokeCertificateAdmin({ params: { id: CERT }, body: { reason: 'Plagiat aşkarlandı' }, user: admin }, res);
  assert.equal(res.statusCode, 503, 'fail-closed when the audit log is unavailable');
  assert.equal(state.queries.some((x) => /^UPDATE certificates/.test(x.sql)), false);

  reset(state.handlers);
  res = resMock();
  await revokeCertificateAdmin({ params: { id: CERT }, body: { reason: 'Plagiat aşkarlandı' }, user: admin }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0].action, 'certificate.revoke');
  assert.equal(state.audits[0].entityType, 'certificate');
  assert.equal(state.audits[0].targetUserId, U(2));
  const updIdx = state.queries.findIndex((x) => /^UPDATE certificates SET status = 'revoked'/.test(x.sql));
  assert.ok(state.audits[0].at <= updIdx, 'audit row is written before the UPDATE');
  assert.deepEqual(state.queries[updIdx].params, [CERT, U(1), 'Plagiat aşkarlandı']);
  assert.equal(state.notifications.length, 1);
  const n = state.notifications[0];
  assert.equal(n.eventType, 'certificate_status_changed');
  assert.equal(n.email, true, 'the existing status-change email is sent');
  assert.equal(n.params.statusLabel, 'ləğv olunub');
  assert.equal(JSON.stringify(n).includes('Plagiat'), false, 'reason never reaches the student notice');
});

test('reinstate: only revoked certificates, blocked when another active one exists, audited', async () => {
  let otherIssued = true;
  reset([
    [/^SELECT id, student_id, exam_id, status, certificate_no FROM certificates/, () => ({ rows: [certRow('revoked')] })],
    [/FOR UPDATE$/, () => ({ rows: [certRow('revoked')] })],
    [/status = 'issued' AND id <> \$3/, () => ({ rows: otherIssued ? [{ '?column?': 1 }] : [] })],
    [/^UPDATE certificates SET status = 'issued'/, () => ({ rows: [{ id: CERT, status: 'issued' }] })],
    [/^SELECT student_id, instructor_id, title FROM certificates/, () => ({ rows: [{ student_id: U(2), instructor_id: U(9), title: 'Riyaziyyat' }] })],
  ]);
  let res = resMock();
  await reinstateCertificateAdmin({ params: { id: CERT }, body: { reason: 'Səhv ləğv edilmişdi' }, user: admin }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, 'NEWER_CERTIFICATE_EXISTS');

  otherIssued = false;
  reset(state.handlers);
  res = resMock();
  await reinstateCertificateAdmin({ params: { id: CERT }, body: { reason: 'Səhv ləğv edilmişdi' }, user: admin }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(state.audits[0].action, 'certificate.reinstate');
  const upd = state.queries.find((x) => /^UPDATE certificates SET status = 'issued'/.test(x.sql));
  assert.match(upd.sql, /revoked_at = NULL, revoked_by = NULL, revoke_reason = NULL/);
  assert.equal(state.notifications[0].eventType, 'certificate_reinstated');
  assert.equal(state.notifications[0].email, true);
});

test('public verify: revoked status + date, never the reason', async () => {
  reset([
    [
      /WHERE c\.verification_token = \$1/,
      () => ({
        rows: [
          {
            id: CERT,
            certificate_no: 'MX-2026-000001',
            verification_token: 'tok',
            title: 'Riyaziyyat',
            subject: null,
            score_pct: '91',
            pass_pct: '70',
            status: 'revoked',
            issued_at: new Date('2026-09-01T08:00:00Z'),
            revoked_at: new Date('2026-10-01T08:00:00Z'),
            locale: 'az',
            snapshot_json: { assessed_modules: ['Cəbr'] },
            student_name: 'Aysel',
            instructor_name: 'Müəllim',
          },
        ],
      }),
    ],
  ]);
  const out = await certificateService.getPublicVerification('tok');
  assert.equal(out.valid, false);
  assert.equal(out.status, 'revoked');
  assert.equal(out.revoked, true);
  assert.equal(new Date(out.revoked_at).toISOString(), '2026-10-01T08:00:00.000Z');
  assert.equal('revoke_reason' in out, false);
  assert.equal(/revoke_reason|revoked_by/.test(state.queries[0].sql), false, 'reason is not even selected');
});

test('a revoked certificate blocks automatic re-issue for the same student + exam', async () => {
  reset([
    [/WHERE student_id = \$1 AND exam_id = \$2 AND status = 'issued'/, () => ({ rows: [] })],
    [/status = 'revoked' LIMIT 1/, () => ({ rows: [{ '?column?': 1 }] })],
  ]);
  const out = await certificateService.getOrIssueCertificateForStudentExam(U(2), U(7));
  assert.equal(out.certificate, null);
  assert.equal(out.eligibility.reason, 'revoked');
  assert.equal(state.queries.some((x) => /FROM exam_results/.test(x.sql)), false);
});

test('admin certificate routes are admin-only', () => {
  const src = fs.readFileSync(path.join(__dirname, '../routes/admin.js'), 'utf8');
  for (const route of ["'/certificates'", "'/certificates/:id/revoke'", "'/certificates/:id/reinstate'"]) {
    const line = src.split('\n').find((l) => l.includes(route));
    assert.ok(line, `${route} registered`);
    assert.match(line, /authenticate, authorize\('admin'\)/);
  }
});
