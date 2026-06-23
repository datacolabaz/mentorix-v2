const { normUuid, parentOwnsStudent } = require('./studentAccessGuard');

async function assertEnrollmentReadAccess(user, enrollment) {
  if (!user || !enrollment) {
    const err = new Error('İcazə yoxdur');
    err.statusCode = 403;
    throw err;
  }

  const { student_id: studentId, instructor_id: instructorId } = enrollment;

  if (user.role === 'admin') return;

  if (user.role === 'student') {
    if (String(studentId) !== String(user.id)) {
      const err = new Error('İcazə yoxdur');
      err.statusCode = 403;
      throw err;
    }
    return;
  }

  if (user.role === 'instructor') {
    if (normUuid(instructorId) !== normUuid(user.id)) {
      const err = new Error('İcazə yoxdur');
      err.statusCode = 403;
      throw err;
    }
    return;
  }

  if (user.role === 'parent') {
    const ok = await parentOwnsStudent(user.id, studentId);
    if (!ok) {
      const err = new Error('İcazə yoxdur');
      err.statusCode = 403;
      throw err;
    }
    return;
  }

  const err = new Error('İcazə yoxdur');
  err.statusCode = 403;
  throw err;
}

module.exports = {
  assertEnrollmentReadAccess,
};
