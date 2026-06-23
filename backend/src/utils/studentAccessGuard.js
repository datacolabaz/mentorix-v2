const db = require('./db');

function normUuid(id) {
  return String(id || '').trim().toLowerCase().replace(/-/g, '');
}

function sameUuid(a, b) {
  if (a == null || b == null) return false;
  return normUuid(a) === normUuid(b);
}

async function instructorOwnsStudent(instructorId, studentId, client = db) {
  const { rows } = await client.query(
    `SELECT 1
     FROM enrollments e
     WHERE e.student_id = $1::uuid
       AND e.status = 'active'
       AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $2
     LIMIT 1`,
    [studentId, normUuid(instructorId)],
  );
  return Boolean(rows[0]);
}

async function parentOwnsStudent(parentId, studentId, client = db) {
  const { rows } = await client.query(
    `SELECT 1 FROM student_profiles
     WHERE user_id = $1::uuid AND parent_id = $2::uuid
     LIMIT 1`,
    [studentId, parentId],
  );
  return Boolean(rows[0]);
}

async function assertStudentReadAccess(user, studentId) {
  if (!user || !studentId) {
    const err = new Error('İcazə yoxdur');
    err.statusCode = 403;
    throw err;
  }

  if (user.role === 'admin') return;

  if (user.role === 'student') {
    if (!sameUuid(user.id, studentId)) {
      const err = new Error('İcazə yoxdur');
      err.statusCode = 403;
      throw err;
    }
    return;
  }

  if (user.role === 'instructor') {
    const ok = await instructorOwnsStudent(user.id, studentId);
    if (!ok) {
      const err = new Error('Bu tələbəni görmək üçün icazə yoxdur');
      err.statusCode = 403;
      throw err;
    }
    return;
  }

  if (user.role === 'parent') {
    const ok = await parentOwnsStudent(user.id, studentId);
    if (!ok) {
      const err = new Error('Bu tələbəni görmək üçün icazə yoxdur');
      err.statusCode = 403;
      throw err;
    }
    return;
  }

  const err = new Error('İcazə yoxdur');
  err.statusCode = 403;
  throw err;
}

async function assertInstructorMayEditStudent(user, studentId) {
  if (user.role === 'admin') return;
  if (user.role !== 'instructor') {
    const err = new Error('İcazə yoxdur');
    err.statusCode = 403;
    throw err;
  }
  const ok = await instructorOwnsStudent(user.id, studentId);
  if (!ok) {
    const err = new Error('Bu tələbəni redaktə etmək üçün icazə yoxdur');
    err.statusCode = 403;
    throw err;
  }
}

function stripSensitiveUserFields(row) {
  if (!row || typeof row !== 'object') return row;
  const {
    password_hash: _ph,
    pin_hash: _pin,
    ...safe
  } = row;
  return safe;
}

module.exports = {
  normUuid,
  sameUuid,
  instructorOwnsStudent,
  parentOwnsStudent,
  assertStudentReadAccess,
  assertInstructorMayEditStudent,
  stripSensitiveUserFields,
};
