const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  enrollmentCountsTowardStudentUsage,
  instructorVisibleStudentsWhereSql,
} = require('./instructorVisibleStudents');

describe('enrollmentCountsTowardStudentUsage', () => {
  const visible = {
    user_role: 'student',
    user_is_active: true,
    enrollment_id: 'e1',
    status: 'active',
    enrollment_source: 'group',
  };

  it('counts active CRM/group enrollments', () => {
    assert.equal(enrollmentCountsTowardStudentUsage(visible), true);
    assert.equal(
      enrollmentCountsTowardStudentUsage({ ...visible, status: 'pending_setup', enrollment_source: 'group' }),
      true,
    );
    assert.equal(
      enrollmentCountsTowardStudentUsage({ ...visible, status: 'pending_approval', enrollment_source: 'manual' }),
      true,
    );
  });

  it('does not count lifetime instructor_students leftovers after delete', () => {
    assert.equal(
      enrollmentCountsTowardStudentUsage({ ...visible, user_is_active: false, user_deleted_at: '2026-01-01' }),
      false,
    );
    assert.equal(
      enrollmentCountsTowardStudentUsage({ ...visible, enrollment_deleted_at: '2026-01-01' }),
      false,
    );
  });

  it('hides pending_setup exam/task guests the same way Tələbələrim does', () => {
    assert.equal(
      enrollmentCountsTowardStudentUsage({
        ...visible,
        status: 'pending_setup',
        enrollment_source: 'exam',
      }),
      false,
    );
    assert.equal(
      enrollmentCountsTowardStudentUsage({
        ...visible,
        status: 'pending_setup',
        enrollment_source: 'task',
      }),
      false,
    );
    assert.equal(
      enrollmentCountsTowardStudentUsage({
        ...visible,
        status: 'active',
        enrollment_source: 'exam',
      }),
      true,
    );
  });
});

describe('instructorVisibleStudentsWhereSql', () => {
  it('requires deleted_at null and excludes pending exam/task setup', () => {
    const sql = instructorVisibleStudentsWhereSql({ instructorParam: 1 });
    assert.match(sql, /e\.deleted_at IS NULL/);
    assert.match(sql, /u\.deleted_at IS NULL/);
    assert.match(sql, /pending_setup/);
    assert.match(sql, /'exam', 'task'/);
    assert.doesNotMatch(sql, /instructor_students/);
  });
});
