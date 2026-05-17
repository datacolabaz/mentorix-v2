/**
 * Tədris mərkəzi (role: course) — org CRM scope.
 * Bütün sorğular yalnız courses.is_organization = TRUE və course_id üzrə.
 * Fərdi müəllim (instructor_id) datası buraya avtomatik daxil olmur.
 */
const db = require('../utils/db');
const { bakuTodayYmd } = require('../controllers/monthlyAttendanceController');
const { roundMoney } = require('./subscriptionBilling');
const { normalizePhone } = require('./authService');
const { findUserByPhone, userHasRole, isInstructorAccount } = require('./userRolesService');

const TEACHER_STATUSES = ['INVITED', 'ACTIVE'];
const INSTRUCTOR_NOT_FOUND_MSG =
  'Müəllim tapılmadı, zəhmət olmasa əvvəlcə onun platformada qeydiyyatdan keçdiyinə əmin olun';

const LEAD_STATUSES = ['new', 'contacted', 'trial_scheduled', 'trial_done', 'thinking', 'won', 'lost'];

async function ensureOrgCourseForOwner(ownerUserId) {
  const { rows: prof } = await db.query(
    `SELECT course_name FROM course_profiles WHERE user_id = $1`,
    [ownerUserId],
  );
  const { rows: userRows } = await db.query(`SELECT full_name FROM users WHERE id = $1`, [ownerUserId]);
  const profileName = prof[0]?.course_name ? String(prof[0].course_name).trim() : '';
  const fullName = userRows[0]?.full_name || '';
  const name = profileName || fullName || 'Kursum';

  const { rows: existing } = await db.query(
    `SELECT id, owner_user_id, name FROM courses
     WHERE owner_user_id = $1 AND COALESCE(is_organization, FALSE) = TRUE
     ORDER BY created_at ASC LIMIT 1`,
    [ownerUserId],
  );

  if (existing.length) {
    const { rows: updated } = await db.query(
      `UPDATE courses SET name = COALESCE(NULLIF(TRIM($2), ''), name), updated_at = NOW()
       WHERE id = $1 RETURNING id, owner_user_id, name`,
      [existing[0].id, name],
    );
    return updated[0];
  }

  const { rows: inserted } = await db.query(
    `INSERT INTO courses (owner_user_id, name, is_organization)
     VALUES ($1, $2, TRUE) RETURNING id, owner_user_id, name`,
    [ownerUserId, name],
  );
  return inserted[0];
}

async function assertOrgCourseOwner(courseId, ownerUserId) {
  const { rows } = await db.query(
    `SELECT id, name, owner_user_id FROM courses
     WHERE id = $1 AND owner_user_id = $2 AND COALESCE(is_organization, FALSE) = TRUE`,
    [courseId, ownerUserId],
  );
  return rows[0] || null;
}

async function countCourseStudents(courseId) {
  const { rows } = await db.query(
    `SELECT COUNT(DISTINCT cs.student_id)::int AS c
     FROM course_students cs
     INNER JOIN users u ON u.id = cs.student_id
     WHERE cs.course_id = $1 AND COALESCE(u.is_active, TRUE) = TRUE`,
    [courseId],
  );
  return rows[0]?.c ?? 0;
}

async function countCourseTeachers(courseId) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS c FROM course_teachers ct
     INNER JOIN users u ON u.id = ct.instructor_user_id
     WHERE ct.course_id = $1 AND ct.status = 'ACTIVE' AND ct.is_active = TRUE AND COALESCE(u.is_active, TRUE) = TRUE`,
    [courseId],
  );
  return rows[0]?.c ?? 0;
}

async function findInstructorUserByPhone(cleanPhone) {
  const user = await findUserByPhone(cleanPhone);
  if (!user) return null;
  if (await userHasRole(user.id, 'instructor')) return user;
  if (await isInstructorAccount(user.id)) return user;
  return null;
}

async function addOrgTeacher(ownerUserId, phone) {
  const course = await ensureOrgCourseForOwner(ownerUserId);
  const clean = normalizePhone(phone);
  if (!clean) {
    const err = new Error('Telefon nömrəsi tələb olunur');
    err.statusCode = 400;
    throw err;
  }

  const instructor = await findInstructorUserByPhone(clean);
  if (!instructor) {
    const err = new Error(INSTRUCTOR_NOT_FOUND_MSG);
    err.statusCode = 404;
    throw err;
  }

  if (String(instructor.id) === String(ownerUserId)) {
    const err = new Error('Siz kursun sahibisiniz; özünüzü müəllim kimi əlavə etməyə ehtiyac yoxdur.');
    err.statusCode = 400;
    throw err;
  }

  const { rows: existing } = await db.query(
    `SELECT status, is_active FROM course_teachers
     WHERE course_id = $1 AND instructor_user_id = $2`,
    [course.id, instructor.id],
  );

  if (existing.length && existing[0].status === 'ACTIVE' && existing[0].is_active) {
    const err = new Error('Bu müəllim artıq kurs heyətindədir');
    err.statusCode = 409;
    throw err;
  }

  const { rows } = await db.query(
    `INSERT INTO course_teachers (course_id, instructor_user_id, is_active, status)
     VALUES ($1, $2, TRUE, 'ACTIVE')
     ON CONFLICT (course_id, instructor_user_id) DO UPDATE SET
       is_active = TRUE,
       status = 'ACTIVE'
     RETURNING course_id, instructor_user_id, status, created_at`,
    [course.id, instructor.id],
  );

  return {
    id: instructor.id,
    full_name: instructor.full_name,
    phone: instructor.phone,
    status: rows[0].status,
    is_owner: false,
    course_students_count: 0,
  };
}

async function countCourseGroups(courseId) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS c FROM course_groups cg
     WHERE cg.course_id = $1 AND cg.is_active = TRUE AND cg.instructor_group_id IS NULL`,
    [courseId],
  );
  return rows[0]?.c ?? 0;
}

async function countLeadsByStatus(courseId) {
  const { rows } = await db.query(
    `SELECT status, COUNT(*)::int AS c FROM course_leads
     WHERE course_id = $1 GROUP BY status`,
    [courseId],
  );
  const map = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0]));
  let total = 0;
  for (const r of rows) {
    map[r.status] = Number(r.c) || 0;
    total += map[r.status];
  }
  return { total, by_status: map };
}

async function getOrgSettings(ownerUserId) {
  const course = await ensureOrgCourseForOwner(ownerUserId);
  const { rows: prof } = await db.query(
    `SELECT course_name, logo_url, branch_address FROM course_profiles WHERE user_id = $1`,
    [ownerUserId],
  );
  const { rows: userRows } = await db.query(`SELECT full_name FROM users WHERE id = $1`, [ownerUserId]);
  const fullName = (userRows[0]?.full_name || '').trim();
  const p = prof[0] || {};
  const courseName = (p.course_name || course.name || '').trim();
  const needsBranding =
    !courseName ||
    courseName === fullName ||
    courseName === 'Kursum' ||
    courseName.toLowerCase() === 'kursum';

  return {
    course_id: course.id,
    course_name: courseName,
    logo_url: p.logo_url || null,
    branch_address: p.branch_address || null,
    needs_branding: needsBranding,
  };
}

async function updateOrgSettings(ownerUserId, body) {
  const course = await ensureOrgCourseForOwner(ownerUserId);
  const courseName = String(body?.course_name || '').trim();
  if (!courseName) {
    const err = new Error('Kurs adı tələb olunur');
    err.statusCode = 400;
    throw err;
  }
  const branch = body?.branch_address != null ? String(body.branch_address).trim() : null;

  await db.query(
    `INSERT INTO course_profiles (user_id, course_name, branch_address)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET
       course_name = EXCLUDED.course_name,
       branch_address = COALESCE(EXCLUDED.branch_address, course_profiles.branch_address),
       updated_at = NOW()`,
    [ownerUserId, courseName, branch || null],
  );
  await db.query(`UPDATE courses SET name = $1, updated_at = NOW() WHERE id = $2`, [courseName, course.id]);

  return getOrgSettings(ownerUserId);
}

async function updateOrgLogo(ownerUserId,