const db = require('../utils/db');
const { parseLessonWeekdaysJson, bakuTodayYmd } = require('../controllers/monthlyAttendanceController');
const { loadInstructorMonthlyBalanceRows, roundMoney, getTodayBakuYmd } = require('./subscriptionBilling');

function normUuid(id) {
  return String(id || '').trim().toLowerCase().replace(/-/g, '');
}

function isoDowMon1FromYmd(ymd) {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const w = dt.getUTCDay();
  return w === 0 ? 7 : w;
}

async function getCourseByOwnerUserId(ownerUserId) {
  const { rows } = await db.query(
    `SELECT c.id, c.owner_user_id, c.name, cp.course_name, cp.logo_url
     FROM courses c
     LEFT JOIN course_profiles cp ON cp.user_id = c.owner_user_id
     WHERE c.owner_user_id = $1`,
    [ownerUserId],
  );
  return rows[0] || null;
}

/** Kurs paneli sahibi üçün courses + course_teachers (özü müəllimdirsə) təmin et */
async function ensureCourseForOwner(ownerUserId) {
  const { rows: prof } = await db.query(
    `SELECT course_name FROM course_profiles WHERE user_id = $1`,
    [ownerUserId],
  );
  const { rows: userRows } = await db.query(`SELECT full_name FROM users WHERE id = $1`, [ownerUserId]);
  const name = prof[0]?.course_name || userRows[0]?.full_name || 'Kursum';

  const { rows: courseRows } = await db.query(
    `INSERT INTO courses (owner_user_id, name)
     VALUES ($1, $2)
     ON CONFLICT (owner_user_id) DO UPDATE SET
       name = COALESCE(NULLIF(TRIM(EXCLUDED.name), ''), courses.name),
       updated_at = NOW()
     RETURNING id, owner_user_id, name`,
    [ownerUserId, name],
  );
  const course = courseRows[0];

  const { rows: isInstructor } = await db.query(
    `SELECT 1 FROM instructor_profiles WHERE user_id = $1 LIMIT 1`,
    [ownerUserId],
  );
  if (isInstructor.length) {
    await db.query(
      `INSERT INTO course_teachers (course_id, instructor_user_id, is_active)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (course_id, instructor_user_id) DO UPDATE SET is_active = TRUE`,
      [course.id, ownerUserId],
    );
  }

  return course;
}

async function assertCourseAccess(courseId, userId) {
  const { rows } = await db.query(
    `SELECT 1 FROM courses WHERE id = $1 AND owner_user_id = $2`,
    [courseId, userId],
  );
  return rows.length > 0;
}

async function getActiveInstructorIdsForCourse(courseId) {
  const { rows } = await db.query(
    `SELECT ct.instructor_user_id AS id
     FROM course_teachers ct
     INNER JOIN users u ON u.id = ct.instructor_user_id
     WHERE ct.course_id = $1
       AND ct.is_active = TRUE
       AND COALESCE(u.is_active, TRUE) = TRUE`,
    [courseId],
  );
  return rows.map((r) => r.id);
}

async function countActiveTeachers(courseId) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS c
     FROM course_teachers ct
     INNER JOIN users u ON u.id = ct.instructor_user_id
     WHERE ct.course_id = $1
       AND ct.is_active = TRUE
       AND COALESCE(u.is_active, TRUE) = TRUE`,
    [courseId],
  );
  return rows[0]?.c ?? 0;
}

async function countActiveGroups(courseId) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS c FROM course_groups WHERE course_id = $1 AND is_active = TRUE`,
    [courseId],
  );
  return rows[0]?.c ?? 0;
}

async function countUniqueActiveStudents(instructorIds) {
  if (!instructorIds.length) return 0;
  const { rows } = await db.query(
    `SELECT COUNT(DISTINCT e.student_id)::int AS c
     FROM enrollments e
     INNER JOIN users u ON u.id = e.student_id
     WHERE e.instructor_id = ANY($1::uuid[])
       AND u.role = 'student'
       AND COALESCE(u.is_active, TRUE) = TRUE
       AND COALESCE(LOWER(TRIM(e.status)), 'active') = 'active'
       AND e.deleted_at IS NULL`,
    [instructorIds],
  );
  return rows[0]?.c ?? 0;
}

/** Bu gün (Bakı) planlaşdırılmış dərs sayı — lessons + aylıq cədvəl */
async function countLessonsToday(instructorIds) {
  if (!instructorIds.length) return 0;
  const todayBaku = await getTodayBakuYmd(db);
  const todayDow = isoDowMon1FromYmd(todayBaku);

  const { rows: lessonRows } = await db.query(
    `SELECT COUNT(*)::int AS c
     FROM lessons l
     WHERE l.instructor_id = ANY($1::uuid[])
       AND COALESCE(l.status, '') NOT IN ('cancelled')
       AND to_char((l.lesson_date AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') = $2`,
    [instructorIds, todayBaku],
  );
  let total = Number(lessonRows[0]?.c ?? 0) || 0;

  const { rows: monthlyRows } = await db.query(
    `SELECT e.id, e.lesson_weekdays, e.enrollment_start_date
     FROM enrollments e
     INNER JOIN users u ON u.id = e.student_id
     WHERE e.instructor_id = ANY($1::uuid[])
       AND e.billing_type = 'monthly'
       AND u.role = 'student'
       AND COALESCE(u.is_active, TRUE) = TRUE
       AND COALESCE(LOWER(TRIM(e.status)), 'active') = 'active'
       AND e.deleted_at IS NULL`,
    [instructorIds],
  );

  for (const row of monthlyRows) {
    const wdays = parseLessonWeekdaysJson(row.lesson_weekdays);
    if (!wdays.includes(todayDow)) continue;
    const anchor = row.enrollment_start_date
      ? String(row.enrollment_start_date).slice(0, 10)
      : null;
    if (anchor && /^\d{4}-\d{2}-\d{2}$/.test(anchor) && anchor > todayBaku) continue;

    const { rows: exists } = await db.query(
      `SELECT 1 FROM lessons l
       WHERE l.enrollment_id = $1
         AND COALESCE(l.status, '') NOT IN ('cancelled')
         AND to_char((l.lesson_date AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') = $2
       LIMIT 1`,
      [row.id, todayBaku],
    );
    if (!exists.length) total += 1;
  }

  return total;
}

/** Cari ay üçün gözlənilən borc (aylıq abunəliklər üzrə) — bütün kurs müəllimləri */
async function sumPendingPaymentsForInstructors(instructorIds) {
  let sum = 0;
  for (const id of instructorIds) {
    const { pendingSum } = await loadInstructorMonthlyBalanceRows(db, normUuid(id));
    sum += Number(pendingSum) || 0;
  }
  return roundMoney(sum);
}

async function getCourseDashboardStats(ownerUserId) {
  const course = await ensureCourseForOwner(ownerUserId);
  const instructorIds = await getActiveInstructorIdsForCourse(course.id);

  const [lessonsToday, activeTeachers, activeStudents, activeGroups, pendingPayments] =
    await Promise.all([
      countLessonsToday(instructorIds),
      countActiveTeachers(course.id),
      countUniqueActiveStudents(instructorIds),
      countActiveGroups(course.id),
      sumPendingPaymentsForInstructors(instructorIds),
    ]);

  return {
    course_id: course.id,
    course_name: course.name,
    lessons_today: lessonsToday,
    active_teachers: activeTeachers,
    active_students: activeStudents,
    active_groups: activeGroups,
    pending_payments: pendingPayments,
    today_baku: await bakuTodayYmd(),
  };
}

module.exports = {
  normUuid,
  getCourseByOwnerUserId,
  ensureCourseForOwner,
  assertCourseAccess,
  getActiveInstructorIdsForCourse,
  getCourseDashboardStats,
};
