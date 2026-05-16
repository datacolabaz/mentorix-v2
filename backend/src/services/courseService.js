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
     WHERE c.owner_user_id = $1
       AND COALESCE(c.is_organization, FALSE) = TRUE
     ORDER BY c.created_at ASC
     LIMIT 1`,
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

  const { rows: existing } = await db.query(
    `SELECT id, owner_user_id, name FROM courses
     WHERE owner_user_id = $1 AND COALESCE(is_organization, FALSE) = TRUE
     ORDER BY created_at ASC
     LIMIT 1`,
    [ownerUserId],
  );

  let course;
  if (existing.length) {
    const { rows: updated } = await db.query(
      `UPDATE courses SET
         name = COALESCE(NULLIF(TRIM($2), ''), name),
         updated_at = NOW()
       WHERE id = $1
       RETURNING id, owner_user_id, name`,
      [existing[0].id, name],
    );
    course = updated[0];
  } else {
    const { rows: inserted } = await db.query(
      `INSERT INTO courses (owner_user_id, name, instructor_id, is_organization)
       VALUES ($1, $2, $1, TRUE)
       RETURNING id, owner_user_id, name`,
      [ownerUserId, name],
    );
    course = inserted[0];
  }

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

/** Kursa bağlı müəllimlər (sahib daxil) + hər birinin aktiv tələbə sayı */
async function listCourseTeachers(courseId, ownerUserId) {
  const { rows } = await db.query(
    `SELECT ct.instructor_user_id AS id,
            u.full_name,
            u.phone,
            (ct.instructor_user_id = $2) AS is_owner,
            (
              SELECT COUNT(DISTINCT e.student_id)::int
              FROM enrollments e
              INNER JOIN users su ON su.id = e.student_id
              WHERE e.instructor_id = ct.instructor_user_id
                AND su.role = 'student'
                AND COALESCE(su.is_active, TRUE) = TRUE
                AND COALESCE(LOWER(TRIM(e.status)), 'active') = 'active'
                AND e.deleted_at IS NULL
            ) AS active_students
     FROM course_teachers ct
     INNER JOIN users u ON u.id = ct.instructor_user_id
     WHERE ct.course_id = $1
       AND ct.is_active = TRUE
       AND COALESCE(u.is_active, TRUE) = TRUE
     ORDER BY is_owner DESC, u.full_name ASC`,
    [courseId, ownerUserId],
  );
  return rows.map((r) => ({
    id: r.id,
    full_name: r.full_name,
    phone: r.phone,
    is_owner: Boolean(r.is_owner),
    active_students: Number(r.active_students) || 0,
    /** Sahibin mövcud müəllim profili avtomatik əlaqələnib (ayrıca "əlavə et" lazım deyil) */
    auto_linked: Boolean(r.is_owner),
  }));
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
    if (!wdays