const test = require('node:test');
const assert = require('node:assert/strict');

let behavior = 'ok';
const inserts = [];
require.cache[require.resolve('../utils/db')] = {
  id: require.resolve('../utils/db'),
  filename: require.resolve('../utils/db'),
  loaded: true,
  exports: {
    query: async (sql, params) => {
      if (behavior === 'missing') {
        const err = new Error('relation "admin_access_audit" does not exist');
        err.code = '42P01';
        throw err;
      }
      if (behavior === 'down') throw new Error('connection reset');
      inserts.push({ sql, params });
      return { rows: [], rowCount: 1 };
    },
  },
};

const { recordAdminAccess, AdminAuditUnavailableError } = require('./adminAccessAudit');

const req = { headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1', 'user-agent': 'UA' }, ip: '10.0.0.1' };

test('admin access writes an audit row with actor, target, reason, ip', async () => {
  behavior = 'ok';
  inserts.length = 0;
  await recordAdminAccess({
    actorUserId: 'admin-1',
    action: 'activity.exams.detail',
    targetUserId: 'teacher-1',
    entityType: 'exam',
    entityId: 'exam-1',
    reason: 'Support ticket 42',
    req,
  });
  assert.equal(inserts.length, 1);
  assert.match(inserts[0].sql, /INSERT INTO admin_access_audit/);
  const p = inserts[0].params;
  assert.equal(p[0], 'admin-1');
  assert.equal(p[1], 'activity.exams.detail');
  assert.equal(p[2], 'teacher-1');
  assert.equal(p[5], 'Support ticket 42');
  assert.equal(p[6], '203.0.113.9');
});

test('fails closed (503) when the audit table is missing or the write fails', async () => {
  for (const b of ['missing', 'down']) {
    behavior = b;
    await assert.rejects(
      recordAdminAccess({ actorUserId: 'admin-1', action: 'x', reason: 'Support ticket 42', req }),
      (err) => err instanceof AdminAuditUnavailableError && err.statusCode === 503 && err.code === 'ADMIN_AUDIT_UNAVAILABLE',
    );
  }
});
