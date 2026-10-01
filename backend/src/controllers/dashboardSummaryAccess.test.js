const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * GET /api/dashboard/summary icazə testi (DB yoxdur: servis əvəzlənir).
 * Yoxlanılır: hər rol yalnız öz xülasəsini alır, sorğu parametri ilə başqasının məlumatı açılmır,
 * valideyn/org/rolsuz istifadəçi bağlıdır, tələbə yalnız öz enrollment-i ilə filtr edə bilər.
 */

const TEACHER_A = '11111111-1111-4111-8111-111111111111';
const TEACHER_B = '22222222-2222-4222-8222-222222222222';
const ADMIN = '33333333-3333-4333-8333-333333333333';
const STUDENT = '55555555-5555-4555-8555-555555555555';
const OTHER_STUDENT = '66666666-6666-4666-8666-666666666666';
const OWN_ENROLLMENT = '77777777-7777-4777-8777-777777777777';
const FOREIGN_ENROLLMENT = '88888888-8888-4888-8888-888888888888';

const calls = [];
let failNext = false;

function mock(modPath, exports) {
  const id = require.resolve(modPath);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

function stub(name, role) {
  return async (ownerId, opts) => {
    calls.push({ name, ownerId, opts });
    if (failNext) {
      failNext = false;
      const err = new Error('relation "x" does not exist');
      err.code = '42P01';
      throw err;
    }
    return { role, items: [] };
  };
}

mock('../services/dashboardSummaryService', {
  getAdminSummary: stub('getAdminSummary', 'admin'),
  getTeacherSummary: stub('getTeacherSummary', 'teacher'),
  getStudentSummary: stub('getStudentSummary', 'student'),
  getAdminOperations: async () => {
    calls.push({ name: 'getAdminOperations' });
    return { security: null };
  },
});
mock('../services/studentEnrollmentsService', {
  resolveEnrollmentScope: async (studentId, enrollmentId) => {
    calls.push({ name: 'resolveEnrollmentScope', ownerId: studentId, opts: enrollmentId });
    return studentId === STUDENT && enrollmentId === OWN_ENROLLMENT
      ? { enrollment_id: OWN_ENROLLMENT, instructor_id: TEACHER_A, group_id: null, subject_id: null }
      : null;
  },
});

const c = require('./dashboardSummaryController');
const { authorize } = require('../middleware/auth');

function call(handler, { user, query = {} }) {
  return new Promise((resolve) => {
    const headers = {};
    const res = {
      statusCode: 200,
      set(k, v) {
        headers[k] = v;
        return this;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        resolve({ status: this.statusCode, body: data, headers });
        return this;
      },
    };
    handler({ user, query, params: {}, body: {}, headers: {}, get: () => undefined }, res);
  });
}

test.beforeEach(() => {
  calls.length = 0;
  failNext = false;
});

test('teacher gets only own workspace; ?instructor_id= of another teacher is ignored', async () => {
  const res = await call(c.getSummary, {
    user: { id: TEACHER_A, role: 'instructor' },
    query: { instructor_id: TEACHER_B, student_id: OTHER_STUDENT },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.summary.role, 'teacher');
  assert.deepEqual(calls.map((x) => [x.name, x.ownerId]), [['getTeacherSummary', TEACHER_A]]);
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
});

test('student gets only own data; ?student_id= of another student is ignored', async () => {
  const res = await call(c.getSummary, { user: { id: STUDENT, role: 'student' }, query: { student_id: OTHER_STUDENT } });
  assert.equal(res.status, 200);
  assert.deepEqual(calls.map((x) => [x.name, x.ownerId]), [['getStudentSummary', STUDENT]]);
  assert.equal(calls[0].opts.instructorId, null);
});

test('student enrollment filter: own enrollment scopes to its teacher; foreign → 404; malformed → 400', async () => {
  const own = await call(c.getSummary, { user: { id: STUDENT, role: 'student' }, query: { enrollment_id: OWN_ENROLLMENT } });
  assert.equal(own.status, 200);
  assert.equal(own.body.summary.enrollment_id, OWN_ENROLLMENT);
  const svcCall = calls.find((x) => x.name === 'getStudentSummary');
  assert.equal(svcCall.ownerId, STUDENT);
  assert.equal(svcCall.opts.instructorId, TEACHER_A);

  calls.length = 0;
  const foreign = await call(c.getSummary, {
    user: { id: STUDENT, role: 'student' },
    query: { enrollment_id: FOREIGN_ENROLLMENT },
  });
  assert.equal(foreign.status, 404);
  assert.equal(calls.some((x) => x.name === 'getStudentSummary'), false);

  const bad = await call(c.getSummary, { user: { id: STUDENT, role: 'student' }, query: { enrollment_id: 'abc' } });
  assert.equal(bad.status, 400);
});

test('admin gets the aggregate summary for themselves only', async () => {
  const res = await call(c.getSummary, { user: { id: ADMIN, role: 'admin' }, query: { instructor_id: TEACHER_A } });
  assert.equal(res.status, 200);
  assert.deepEqual(calls.map((x) => [x.name, x.ownerId]), [['getAdminSummary', ADMIN]]);
});

test('parent, org (course) and role-less users are denied; anonymous → 401', async () => {
  for (const role of ['parent', 'course', null]) {
    const res = await call(c.getSummary, { user: { id: TEACHER_B, role } });
    assert.equal(res.status, 403, `role ${role}`);
    assert.equal(res.body.code, 'DASHBOARD_ROLE_UNSUPPORTED');
  }
  const anon = await call(c.getSummary, { user: undefined });
  assert.equal(anon.status, 401);
  assert.equal(calls.length, 0);
});

test('database errors are not leaked to the client', async () => {
  failNext = true;
  const res = await call(c.getSummary, { user: { id: TEACHER_A, role: 'instructor' } });
  assert.equal(res.status, 500);
  assert.doesNotMatch(JSON.stringify(res.body), /relation|42P01/);
});

test('admin operations route is admin-only (authorize middleware)', async () => {
  const guard = authorize('admin');
  for (const role of ['instructor', 'student', 'parent', 'course']) {
    const res = await new Promise((resolve) => {
      const r = {
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
      guard({ user: { id: TEACHER_A, role } }, r, () => resolve({ status: 'next' }));
    });
    assert.equal(res.status, 403, `role ${role}`);
  }
  const ok = await call(c.getAdminOperations, { user: { id: ADMIN, role: 'admin' } });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.operations);
});
