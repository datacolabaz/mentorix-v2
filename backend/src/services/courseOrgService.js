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
    `SELECT COUNT(*)::int AS c FROM course_groups WHERE course_id = $1 AND is_active = TRUE`,
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

async function updateOrgLogo(ownerUserId, logoUrl) {
  await ensureOrgCourseForOwner(ownerUserId);
  await db.query(
    `INSERT INTO course_profiles (user_id, logo_url)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET logo_url = EXCLUDED.logo_url, updated_at = NOW()`,
    [ownerUserId, logoUrl],
  );
  return getOrgSettings(ownerUserId);
}

async function getOrgDashboardStats(ownerUserId) {
  const course = await ensureOrgCourseForOwner(ownerUserId);
  const settings = await getOrgSettings(ownerUserId);
  const courseId = course.id;

  const [students, teachers, groups, leads, pendingRow] = await Promise.all([
    countCourseStudents(courseId),
    countCourseTeachers(courseId),
    countCourseGroups(courseId),
    countLeadsByStatus(courseId),
    db.query(
      `SELECT COALESCE(SUM(p.amount), 0)::numeric AS pending
       FROM payments p
       INNER JOIN course_students cs ON cs.enrollment_id = p.enrollment_id AND cs.course_id = $1
       WHERE p.status = 'pending'`,
      [courseId],
    ),
  ]);

  return {
    course_id: courseId,
    course_name: settings.course_name,
    logo_url: settings.logo_url,
    needs_branding: settings.needs_branding,
    data_isolated: true,
    lessons_today: 0,
    active_teachers: teachers,
    active_students: students,
    active_groups: groups,
    pending_payments: roundMoney(Number(pendingRow.rows[0]?.pending ?? 0)),
    leads_total: leads.total,
    leads_new: leads.by_status.new ?? 0,
    leads_by_status: leads.by_status,
    today_baku: await bakuTodayYmd(),
  };
}

async function listLeads(courseId, { status } = {}) {
  const params = [courseId];
  let sql = `SELECT l.*, u.full_name AS assigned_name
    FROM course_leads l
    LEFT JOIN users u ON u.id = l.assigned_to
    WHERE l.course_id = $1`;
  if (status && LEAD_STATUSES.includes(status)) {
    params.push(status);
    sql += ` AND l.status = $${params.length}`;
  }
  sql += ` ORDER BY l.created_at DESC`;
  const { rows } = await db.query(sql, params);
  return rows;
}

async function createLead(courseId, body) {
  const full_name = String(body?.full_name || '').trim();
  if (!full_name) {
    const err = new Error('Ad tələb olunur');
    err.statusCode = 400;
    throw err;
  }
  const status = LEAD_STATUSES.includes(body?.status) ? body.status : 'new';
  const { rows } = await db.query(
    `INSERT INTO course_leads (course_id, full_name, phone, source, status, notes, trial_lesson_at, assigned_to)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      courseId,
      full_name,
      body?.phone ? String(body.phone).trim() : null,
      String(body?.source || 'manual').slice(0, 50),
      status,
      body?.notes ? String(body.notes).trim() : null,
      body?.trial_lesson_at || null,
      body?.assigned_to || null,
    ],
  );
  return rows[0];
}

async function updateLead(courseId, leadId, body) {
  const fields = [];
  const params = [courseId, leadId];
  const allowed = ['full_name', 'phone', 'source', 'status', 'notes', 'trial_lesson_at', 'assigned_to'];
  for (const key of allowed) {
    if (body[key] === undefined) continue;
    if (key === 'status' && !LEAD_STATUSES.includes(body.status)) continue;
    params.push(body[key]);
    fields.push(`${key} = $${params.length}`);
  }
  if (!fields.length) {
    const err = new Error('Yenilənəcək sahə yoxdur');
    err.statusCode = 400;
    throw err;
  }
  fields.push('updated_at = NOW()');
  const { rows } = await db.query(
    `UPDATE course_leads SET ${fields.join(', ')}
     WHERE course_id = $1 AND id = $2 RETURNING *`,
    params,
  );
  if (!rows.length) {
    const err = new Error('Lead tapılmadı');
    err.statusCode = 404;
    throw err;
  }
  return rows[0];
}

async function listOrgTeachers(courseId, ownerUserId) {
  const { rows } = await db.query(
    `SELECT ct.instructor_user_id AS id, u.full_name, u.phone, ct.status,
            (ct.instructor_user_id = $2) AS is_owner,
            (
              SELECT COUNT(DISTINCT cs.student_id)::int
              FROM course_students cs
              WHERE cs.course_id = $1
                AND cs.enrollment_id IN (
                  SELECT e.id FROM enrollments e
                  WHERE e.instructor_id = ct.instructor_user_id AND e.deleted_at IS NULL
                )
            ) AS course_students_count
     FROM course_teachers ct
     INNER JOIN users u ON u.id = ct.instructor_user_id
     WHERE ct.course_id = $1 AND ct.status = 'ACTIVE' AND ct.is_active = TRUE
     ORDER BY u.full_name`,
    [courseId, ownerUserId],
  );
  return rows;
}

module.exports = {
  LEAD_STATUSES,
  TEACHER_STATUSES,
  INSTRUCTOR_NOT_FOUND_MSG,
  ensureOrgCourseForOwner,
  assertOrgCourseOwner,
  getOrgSettings,
  updateOrgSettings,
  updateOrgLogo,
  getOrgDashboardStats,
  listLeads,
  createLead,
  updateLead,
  listOrgTeachers,
  addOrgTeacher,
};
