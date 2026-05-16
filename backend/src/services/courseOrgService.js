/**
 * Tədris mərkəzi (role: course) — org CRM scope.
 * Bütün sorğular yalnız courses.is_organization = TRUE və course_id üzrə.
 * Fərdi müəllim (instructor_id) datası buraya avtomatik daxil olmur.
 */
const db = require('../utils/db');
const { bakuTodayYmd } = require('../controllers/monthlyAttendanceController');
const { roundMoney } = require('./subscriptionBilling');

const LEAD_STATUSES = ['new', 'contacted', 'trial_scheduled', 'trial_done', 'thinking', 'won', 'lost'];

async function ensureOrgCourseForOwner(ownerUserId) {
  const { rows: prof } = await db.query(
    `SELECT course_name FROM course_profiles WHERE user_id = $1`,
    [ownerUserId],
  );
  const { rows: userRows } = await db.query(`SELECT full_name FROM users WHERE id = $1`, [ownerUserId]);
  const name = prof[0]?.course_name || userRows[0]?.full_name || 'Kursum';

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
     WHERE ct.course_id = $1 AND ct.is_active = TRUE AND COALESCE(u.is_active, TRUE) = TRUE`,
    [courseId],
  );
  return rows[0]?.c ?? 0;
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

async function getOrgDashboardStats(ownerUserId) {
  const course = await ensureOrgCourseForOwner(ownerUserId);
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
    course_name: course.name,
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
    `SELECT ct.instructor_user_id AS id, u.full_name, u.phone,
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
     WHERE ct.course_id = $1 AND ct.is_active = TRUE
     ORDER BY u.full_name`,
    [courseId, ownerUserId],
  );
  return rows;
}

module.exports = {
  LEAD_STATUSES,
  ensureOrgCourseForOwner,
  assertOrgCourseOwner,
  getOrgDashboardStats,
  listLeads,
  createLead,
  updateLead,
  listOrgTeachers,
};
