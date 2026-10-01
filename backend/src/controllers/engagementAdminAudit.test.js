const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * Admin baxışı uçdan-uca: controller + activityAccessPolicy + adminAccessAudit (real) + saxta DB.
 * Yoxlanılır: səbəblə baxış audit sətri yazır (məlumat oxunmazdan əvvəl), səbəbsiz 400, cədvəl yoxdursa 503.
 */

const TEACHER_B = '22222222-2222-4222-8222-222222222222';
const ADMIN = '33333333-3333-4333-8333-333333333333';
const MATERIAL = '66666666-6666-4666-8666-666666666666';

const order = [];
const dbQueries = [];
let dbMode = 'ok';

function mock(modPath, exports) {
  const id = require.resolve(modPath);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

mock('../utils/db', {
  query: async (sql, params) => {
    if (dbMode === 'missing') {
      const err = new Error('relation "admin_access_audit" does not exist');
      err.code = '42P01';
      throw err;
    }
    dbQueries.push({ sql, params });
    order.push('audit');
    return { rows: [], rowCount: 1 };
  },
});

const read = (name) => async (ownerId) => {
  order.push(`read:${name}:${ownerId}`);
  return name.endsWith('Detail') ? { material: { id: MATERIAL }, students: [] } : [];
};
mock('../services/engagementService', {
  getMaterialSummaries: read('getMaterialSummaries'),
  getMaterialDetail: read('getMaterialDetail'),
  getAssignmentSummaries: read('getAssignmentSummaries'),
  getAssignmentDetail: read('getAssignmentDetail'),
  getExamSummaries: read('getExamSummaries'),
  getExamDetail: read('getExamDetail'),
  recordMaterialEvent: async () => ({}),
  sendReminders: read('sendReminders'),
  setMaterialDueAt: read('setMaterialDueAt'),
});
mock('../utils/examTime', { normalizeExamStartTime: (v) => v });

const c = require('./engagementController');
const { ADMIN_REASON_MIN } = require('../services/activityAccessPolicy');

function call(handler, { user, params = {}, query = {} }) {
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
    const headers = { 'user-agent': 'AdminBrowser/1.0', 'x-forwarded-for': '198.51.100.7' };
    const req = { user, params, query, body: {}, headers, ip: '10.0.0.2', get: (h) => headers[String(h).toLowerCase()] };
    handler(req, res);
  });
}

function reset() {
  order.length = 0;
  dbQueries.length = 0;
  dbMode = 'ok';
}

const admin = { id: ADMIN, role: 'admin' };

test('admin read with a reason writes one audit row, then reads the target teacher data', async () => {
  reset();
  const r = await call(c.getMaterialEngagement, {
    user: admin,
    params: { id: MATERIAL },
    query: { instructor_id: TEACHER_B, reason: '  Dəstək sorğusu   #42 ' },
  });
  assert.equal(r.status, 200);
  assert.deepEqual(order, ['audit', `read:getMaterialDetail:${TEACHER_B}`], 'audit is written before any data is read');
  assert.equal(dbQueries.length, 1);
  assert.match(dbQueries[0].sql, /INSERT INTO admin_access_audit/);
  assert.deepEqual(dbQueries[0].params, [
    ADMIN,
    'activity.materials.detail',
    TEACHER_B,
    'material',
    MATERIAL,
    'Dəstək sorğusu #42',
    '198.51.100.7',
    'AdminBrowser/1.0',
  ]);
});

test('every admin read is audited separately (list + detail)', async () => {
  reset();
  const query = { instructor_id: TEACHER_B, reason: 'Support ticket #42' };
  await call(c.listExamEngagement, { user: admin, query });
  await call(c.listAssignmentEngagement, { user: admin, query });
  assert.equal(dbQueries.length, 2);
  assert.deepEqual(dbQueries.map((q) => q.params[1]), ['activity.exams.list', 'activity.assignments.list']);
});

test('admin read without a reason: 400 with a displayable message, no audit, no data', async () => {
  reset();
  const r = await call(c.listMaterialEngagement, { user: admin, query: { instructor_id: TEACHER_B } });
  assert.equal(r.status, 400);
  assert.equal(r.body.success, false);
  assert.equal(r.body.code, 'ADMIN_REASON_REQUIRED');
  assert.equal(r.body.reason_min_length, ADMIN_REASON_MIN);
  assert.ok(r.body.message.length > 10);
  assert.equal(order.length, 0);
});

test('admin read fails closed (503) if the audit table is missing', async () => {
  reset();
  dbMode = 'missing';
  const r = await call(c.listMaterialEngagement, {
    user: admin,
    query: { instructor_id: TEACHER_B, reason: 'Support ticket #42' },
  });
  assert.equal(r.status, 503);
  assert.equal(r.body.code, 'ADMIN_AUDIT_UNAVAILABLE');
  assert.equal(order.length, 0);
});

test('migration 222 creates the audit table with the same minimum reason length as the API', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../models/migrations/222_admin_access_audit.sql'), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS admin_access_audit/);
  const m = sql.match(/reason TEXT NOT NULL CHECK \(length\(btrim\(reason\)\) >= (\d+)\)/);
  assert.ok(m, 'reason CHECK present');
  assert.equal(Number(m[1]), ADMIN_REASON_MIN);
  for (const col of ['actor_user_id', 'action', 'target_user_id', 'entity_type', 'entity_id', 'ip', 'user_agent', 'created_at']) {
    assert.match(sql, new RegExp(`\\b${col}\\b`), `${col} column`);
  }
  assert.match(sql, /idx_admin_access_audit_actor ON admin_access_audit \(actor_user_id, created_at DESC\)/);
  assert.match(sql, /idx_admin_access_audit_target ON admin_access_audit \(target_user_id, created_at DESC\)/);
});
