const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Müəllim analitikası endpoint-lərinin icazə testi (DB yoxdur: servis və audit əvəzlənir).
 * Yoxlanılır: başqa workspace-ə baxmaq olmur, tələbə/partnyor bağlıdır, admin səbəb + audit olmadan baxa bilmir.
 */

const TEACHER_A = '11111111-1111-4111-8111-111111111111';
const TEACHER_B = '22222222-2222-4222-8222-222222222222';
const ADMIN = '33333333-3333-4333-8333-333333333333';
const EXAM_B = '44444444-4444-4444-8444-444444444444';
const STUDENT = '55555555-5555-4555-8555-555555555555';

const serviceCalls = [];
const auditCalls = [];
let auditFails = false;

function stub(name) {
  return async (ownerId, ...rest) => {
    serviceCalls.push({ name, ownerId, rest });
    return name.startsWith('get') && name.endsWith('Detail') ? { item: true } : [];
  };
}

function mock(modPath, exports) {
  const id = require.resolve(modPath);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

mock('../services/engagementService', {
  getMaterialSummaries: stub('getMaterialSummaries'),
  getMaterialDetail: stub('getMaterialDetail'),
  getAssignmentSummaries: stub('getAssignmentSummaries'),
  getAssignmentDetail: stub('getAssignmentDetail'),
  getExamSummaries: stub('getExamSummaries'),
  getExamDetail: stub('getExamDetail'),
  recordMaterialEvent: async (studentId, materialId) => {
    serviceCalls.push({ name: 'recordMaterialEvent', ownerId: studentId, rest: [materialId] });
    return { duplicate: false, event_type: 'material_opened' };
  },
  sendReminders: stub('sendReminders'),
  setMaterialDueAt: stub('setMaterialDueAt'),
});
mock('../services/adminAccessAudit', {
  recordAdminAccess: async (entry) => {
    if (auditFails) {
      const err = new Error('Admin audit jurnalı hələ qurulmayıb — giriş bağlıdır');
      err.statusCode = 503;
      err.code = 'ADMIN_AUDIT_UNAVAILABLE';
      throw err;
    }
    auditCalls.push(entry);
  },
});
mock('../utils/examTime', { normalizeExamStartTime: (v) => v });

const c = require('./engagementController');

function call(handler, { user, params = {}, query = {}, body = {} }) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        resolve({ status: this.statusCode, body: data });
        return this;
      },
    };
    const req = { user, params, query, body, headers: {}, get: () => undefined };
    handler(req, res);
  });
}

function reset() {
  serviceCalls.length = 0;
  auditCalls.length = 0;
  auditFails = false;
}

test('cross-workspace: teacher A asking for teacher B data is scoped back to A', async () => {
  reset();
  const r = await call(c.getExamEngagement, {
    user: { id: TEACHER_A, role: 'instructor' },
    params: { id: EXAM_B },
    query: { instructor_id: TEACHER_B, reason: 'I want to see it' },
  });
  assert.equal(r.status, 200);
  assert.equal(serviceCalls.length, 1);
  assert.equal(serviceCalls[0].ownerId, TEACHER_A, 'service always receives the caller as owner');
  assert.equal(auditCalls.length, 0, 'teacher reads are not admin-audited');
});

test('students and partners are blocked from teacher analytics', async () => {
  for (const role of ['student', 'partner', 'parent']) {
    reset();
    for (const h of [c.listExamEngagement, c.listMaterialEngagement, c.listAssignmentEngagement]) {
      const r = await call(h, { user: { id: STUDENT, role }, query: { instructor_id: TEACHER_B, reason: 'curious student' } });
      assert.equal(r.status, 403, `${role} blocked`);
      assert.equal(r.body.code, 'ACTIVITY_FORBIDDEN');
    }
    assert.equal(serviceCalls.length, 0);
  }
});

test('student material events are recorded for the caller only, never another student', async () => {
  reset();
  const r = await call(c.postMaterialEvent, {
    user: { id: STUDENT, role: 'student' },
    params: { id: EXAM_B },
    body: { event_type: 'material_opened', student_id: TEACHER_B },
  });
  assert.equal(r.status, 200);
  assert.equal(serviceCalls[0].ownerId, STUDENT);
  assert.deepEqual(Object.keys(r.body).sort(), ['duplicate', 'event_type', 'success'], 'no other students data in the response');
});

test('admin without reason is rejected and nothing is read', async () => {
  reset();
  const r = await call(c.getExamEngagement, {
    user: { id: ADMIN, role: 'admin' },
    params: { id: EXAM_B },
    query: { instructor_id: TEACHER_B },
  });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, 'ADMIN_REASON_REQUIRED');
  assert.match(r.body.message, /səbəb/, 'human-readable message the UI can show');
  assert.equal(r.body.reason_min_length, 5);
  assert.equal(serviceCalls.length, 0);
  assert.equal(auditCalls.length, 0);
});

test('admin without a target teacher gets a clear 400', async () => {
  reset();
  const r = await call(c.listExamEngagement, {
    user: { id: ADMIN, role: 'admin' },
    query: { reason: 'Support ticket #42' },
  });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, 'ADMIN_TARGET_REQUIRED');
  assert.ok(r.body.message);
  assert.equal(serviceCalls.length, 0);
});

test('admin with reason is audited before data is read', async () => {
  reset();
  const r = await call(c.getExamEngagement, {
    user: { id: ADMIN, role: 'admin' },
    params: { id: EXAM_B },
    query: { instructor_id: TEACHER_B, reason: 'Support ticket #42' },
  });
  assert.equal(r.status, 200);
  assert.equal(auditCalls.length, 1);
  assert.deepEqual(
    { actor: auditCalls[0].actorUserId, target: auditCalls[0].targetUserId, entity: auditCalls[0].entityId, reason: auditCalls[0].reason },
    { actor: ADMIN, target: TEACHER_B, entity: EXAM_B, reason: 'Support ticket #42' },
  );
  assert.equal(serviceCalls[0].ownerId, TEACHER_B);
});

test('admin access fails closed when the audit cannot be written', async () => {
  reset();
  auditFails = true;
  const r = await call(c.listMaterialEngagement, {
    user: { id: ADMIN, role: 'admin' },
    query: { instructor_id: TEACHER_B, reason: 'Support ticket #42' },
  });
  assert.equal(r.status, 503);
  assert.equal(r.body.code, 'ADMIN_AUDIT_UNAVAILABLE');
  assert.equal(serviceCalls.length, 0);
});

test('admin cannot send reminders or change deadlines on behalf of a teacher', async () => {
  reset();
  const rem = await call(c.postAssignmentReminders, {
    user: { id: ADMIN, role: 'admin' },
    params: { id: EXAM_B },
    query: { instructor_id: TEACHER_B, reason: 'Support ticket #42' },
  });
  assert.equal(rem.status, 403);
  assert.equal(rem.body.code, 'ADMIN_READ_ONLY');
  const dl = await call(c.patchMaterialDeadline, {
    user: { id: ADMIN, role: 'admin' },
    params: { id: EXAM_B },
    query: { instructor_id: TEACHER_B, reason: 'Support ticket #42' },
    body: { due_at: null },
  });
  assert.equal(dl.status, 403);
  assert.equal(serviceCalls.length, 0);
});
