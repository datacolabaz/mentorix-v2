const db = require('../utils/db');
const { parseLessonWeekdaysJson } = require('../controllers/monthlyAttendanceController');
const { loadInstructorMonthlyBalanceRows, roundMoney } = require('./subscriptionBilling');

function normUuid(id) {
  return String(id || '').trim().toLowerCase().replace(/-/g, '');
}

function parseSchedule(body) {
  let wdays = body?.lesson_weekdays ?? body?.schedule?.days ?? [];
  let times = body?.lesson_times ?? body?.schedule?.times ?? {};
  if (typeof wdays === 'string') {
    try {
      wdays = JSON.parse(wdays);
    } catch {
      wdays = [];
    }
  }
  if (typeof times === 'string') {
    try {
      times = JSON.parse(times);
    } catch {
      times = {};
    }
  }
  const lesson_weekdays = parseLessonWeekdaysJson(wdays);
  const lesson_times = times && typeof times === 'object' && !Array.isArray(times) ? times : {};
  return { lesson_weekdays, lesson_times };
}

async function assertInstructorOwnsCourse(courseId, instructorId) {
  const { rows } = await db.query(
    `SELECT c.*, u.full_name AS instructor_name
     FROM courses c
     LEFT JOIN users u ON u.id = c.instructor_id
     WHERE c.id = $1
       AND REPLACE(LOWER(TRIM(c.instructor_id::text)), '-', '') = $2
       AND COALESCE(c.is_organization, FALSE) = FALSE`,
    [courseId, normUuid(instructorId)],
  );
  return rows[0] || null;
}

async function listCoursesForInstructor(instructorId) {
  const iid = normUuid(instructorId);
  const { rows } = await db.query(
    `SELECT c.id, c.name, c.instructor_id, c.lesson_weekdays, c.lesson_times, c.monthly_fee, c.created_at,
            u.full_name AS instructor_name,
            (
              SELECT COUNT(DISTINCT cs.student_id)::int
              FROM course_students cs
              INNER JOIN users su ON su.id = cs.student_id AND COALESCE(su.is_active, TRUE) = TRUE
              WHERE cs.course_id = c.id
            ) AS student_count,
            (
              SELECT COALESCE(SUM(p.amount), 0)::numeric
              FROM payments p
              WHERE p.course_id = c.id AND p.status = 'completed'
                AND (p.notes IS NULL OR TRIM(p.notes) NOT LIKE '[Balans düzəlişi]%')
                AND COALESCE(p.payment_date::timestamptz, p.paid_at, NOW()) >= date_trunc('month', NOW())
            ) AS income_this_month
     FROM courses c
     LEFT JOIN users u ON u.id = c.instructor_id
     WHERE REPLACE(LOWER(TRIM(c.instructor_id::text)), '-', '') = $1
       AND COALESCE(c.is_organization, FALSE) = FALSE
     ORDER BY c.created_at DESC`,
    [iid],
  );
  return rows;
}

async function getCourseDetail(courseId, instructorId) {
  const course = await assertInstructorOwnsCourse(courseId, instructorId);
  if (!course) return null;

  const { rows: students } = await db.query(
    `SELECT u.id, u.full_name, u.phone, e.id AS enrollment_id, e.billing_type, e.status,
            sp.monthly_fee,
            COALESCE(c.monthly_fee, sp.monthly_fee) AS effective_monthly_fee
     FROM course_students cs
     INNER JOIN users u ON u.id = cs.student_id
     LEFT JOIN enrollments e ON e.id = cs.enrollment_id
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     LEFT JOIN courses c ON c.id = cs.course_id
     WHERE cs.course_id = $1
     ORDER BY u.full_name`,
    [courseId],
  );

  const { rows: payments } = await db.query(
    `SELECT p.id, p.amount, p.status, p.payment_date, p.paid_at, p.payment_method, p.period,
            u.full_name AS student_name
     FROM payments p
     LEFT JOIN users u ON u.id = p.student_id
     WHERE p.course_id = $1
     ORDER BY COALESCE(p.payment_date, p.paid_at::date) DESC NULLS LAST
     LIMIT 50`,
    [courseId],
  );

  const { rows: attendance } = await db.query(
    `SELECT l.id, l.lesson_date, l.status, u.full_name AS student_name
     FROM lessons l
     INNER JOIN users u ON u.id = l.student_id
     WHERE l.enrollment_id IN (
       SELECT enrollment_id FROM course_students WHERE course_id = $1 AND enrollment_id IS NOT NULL
     )
     ORDER BY l.lesson_date DESC
     LIMIT 30`,
    [courseId],
  );

  const iid = normUuid(instructorId);
  let pending_payments = 0;
  const { rows: enrForBal } = await db.query(
    `SELECT DISTINCT e.id FROM enrollments e
     INNER JOIN course_students cs ON cs.enrollment_id = e.id
     WHERE cs.course_id = $1`,
    [courseId],
  );
  const { pendingSum } = await loadInstructorMonthlyBalanceRows(db, iid);
  pending_payments = roundMoney(pendingSum);

  const studentIds = students.map((s) => s.id);

  const { rows: incomeRows } = await db.query(
    `SELECT COALESCE(SUM(p.amount), 0)::numeric AS income_this_month
     FROM payments p
     WHERE p.course_id = $1 AND p.status = 'completed'
       AND (p.notes IS NULL OR TRIM(p.notes) NOT LIKE '[Balans düzəlişi]%')
       AND COALESCE(p.payment_date::timestamptz, p.paid_at, NOW()) >= date_trunc('month', NOW())`,
    [courseId],
  );

  return {
    ...course,
    student_ids: studentIds,
    students,
    payments,
    attendance,
    student_count: students.length,
    pending_payments,
    income_this_month: Number(incomeRows[0]?.income_this_month ?? 0),
  };
}

async function createCourse(instructorId, body) {
  const name = String(body?.name || '').trim();
  if (!name) {
    const err = new Error('Kurs adı tələb olunur');
    err.statusCode = 400;
    throw err;
  }
  const { lesson_weekdays, lesson_times } = parseSchedule(body);
  const monthly_fee =
    body?.monthly_fee != null && body.monthly_fee !== '' ? Number(body.monthly_fee) : null;
  const teacherId = body?.teacher_id || body?.instructor_id || instructorId;

  if (normUuid(teacherId) !== normUuid(instructorId) && body?.teacher_id) {
    const err = new Error('Yalnız öz müəllim hesabınıza kurs yarada bilərsiniz');
    err.statusCode = 403;
    throw err;
  }

  const { rows } = await db.query(
    `INSERT INTO courses (
       name, instructor_id, owner_user_id, lesson_weekdays, lesson_times, monthly_fee, is_organization
     ) VALUES ($1, $2, $2, $3::jsonb, $4::jsonb, $5, FALSE)
     RETURNING *`,
    [
      name,
      instructorId,
      JSON.stringify(lesson_weekdays),
      JSON.stringify(lesson_times),
      Number.isFinite(monthly_fee) ? monthly_fee : null,
    ],
  );
  const course = rows[0];

  const studentIds = Array.isArray(body?.student_ids) ? body.student_ids : [];
  if (studentIds.length) {
    await assignStudentsToCourse(course.id, instructorId, studentIds);
  }

  return getCourseDetail(course.id, instructorId);
}

async function assignStudentsToCourse(courseId, instructorId, studentIds) {
  const course = await assertInstructorOwnsCourse(courseId, instructorId);
  if (!course) {
    const err = new Error('Kurs tapılmadı');
    err.statusCode = 404;
    throw err;
  }

  const unique = [...new Set(studentIds.map(String))];
  for (const sid of unique) {
    const { rows: enr } = await db.query(
      `SELECT id FROM enrollments
       WHERE student_id = $1
         AND REPLACE(LOWER(TRIM(instructor_id::text)), '-', '') = $2
         AND COALESCE(LOWER(TRIM(status)), 'active') = 'active'
         AND deleted_at IS NULL
       ORDER BY enrolled_at DESC NULLS LAST
       LIMIT 1`,
      [sid, normUuid(instructorId)],
    );
    const enrollmentId = enr[0]?.id || null;

    await db.query(
      `INSERT INTO course_students (course_id, student_id, enrollment_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (course_id, student_id) DO UPDATE SET enrollment_id = COALESCE(EXCLUDED.enrollment_id, course_students.enrollment_id)`,
      [courseId, sid, enrollmentId],
    );

    if (enrollmentId) {
      await db.query(`UPDATE enrollments SET course_id = $1 WHERE id = $2`, [courseId, enrollmentId]);
      await db.query(
        `UPDATE payments SET course_id = $1 WHERE enrollment_id = $2 AND course_id IS NULL`,
        [courseId, enrollmentId],
      );
    }
  }
}

async function listAssignableStudents(instructorId) {
  const { rows } = await db.query(
    `SELECT u.id, u.full_name, u.phone, e.id AS enrollment_id
     FROM users u
     INNER JOIN enrollments e ON e.student_id = u.id
     WHERE REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1
       AND u.role = 'student'
       AND COALESCE(u.is_active, TRUE) = TRUE
       AND COALESCE(LOWER(TRIM(e.status)), 'active') = 'active'
       AND e.deleted_at IS NULL
     ORDER BY u.full_name`,
    [normUuid(instructorId)],
  );
  return rows;
}

module.exports = {
  listCoursesForInstructor,
  getCourseDetail,
  createCourse,
  assignStudentsToCourse,
  listAssignableStudents,
  assertInstructorOwnsCourse,
};
