const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  STUDENT_LEAVEABLE_STATUSES,
  leaveEnrollmentForStudent,
} = require('./studentLeaveService');

describe('STUDENT_LEAVEABLE_STATUSES', () => {
  it('includes every status listed on Qruplarım', () => {
    for (const st of ['active', 'pending_setup', 'pending_approval']) {
      assert.ok(STUDENT_LEAVEABLE_STATUSES.includes(st), st);
    }
  });

  it('does not treat already-closed enrollments as leaveable', () => {
    for (const st of ['left', 'rejected', 'archived']) {
      assert.equal(STUDENT_LEAVEABLE_STATUSES.includes(st), false);
    }
  });
});

describe('leaveEnrollmentForStudent', () => {
  it('sets enrollment to left and rejects a pending join request', async () => {
    const queries = [];
    const client = {
      query: async (sql, params) => {
        queries.push({ sql, params });
        if (/UPDATE enrollments/i.test(sql)) {
          return { rows: [{ id: 'enr-1', instructor_id: 'ins-1' }] };
        }
        return { rows: [] };
      },
    };
    const usage = [];
    const result = await leaveEnrollmentForStudent('stu-1', 'enr-1', {
      db: { transaction: async (cb) => cb(client) },
      syncUsage: async (id) => {
        usage.push(id);
      },
    });

    assert.equal(result.id, 'enr-1');
    assert.equal(queries.length, 2);
    assert.match(queries[0].sql, /status = 'left'/);
    assert.deepEqual(queries[0].params, ['enr-1', 'stu-1', STUDENT_LEAVEABLE_STATUSES]);
    assert.match(queries[1].sql, /student_join_requests/);
    assert.match(queries[1].sql, /REJECTED/);
    assert.equal(queries[1].params[0], 'enr-1');
    assert.equal(queries[1].params[1], 'stu-1');
    assert.deepEqual(usage, ['ins-1']);
  });

  it('returns 404 when the enrollment is not leaveable', async () => {
    await assert.rejects(
      () =>
        leaveEnrollmentForStudent('stu-1', 'enr-1', {
          db: {
            transaction: async (cb) => cb({ query: async () => ({ rows: [] }) }),
          },
          syncUsage: async () => {
            throw new Error('should not sync');
          },
        }),
      (err) => err.statusCode === 404 && err.message === 'Aktiv qeydiyyat tapılmadı',
    );
  });
});
