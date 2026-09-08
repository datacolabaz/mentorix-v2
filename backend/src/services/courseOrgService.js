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
const {
  ensureOwnerMembership,
  ensureStaffMembership,
  removeMembership,
  writeOrgAudit,
  permissionsForRole,
  ORG_ROLE_KEYS,
} = require('./orgRbacService');

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
    await ensureOwnerMembership(updated[0].id, ownerUserId);
    return updated[0];
  }

  const { rows: inserted } = await db.query(
    `INSERT INTO courses (owner_user_id, name, is_organization)
     VALUES ($1, $2, TRUE) RETURNING id, owner_user_id, name`,
    [ownerUserId, name],
  );
  await ensureOwnerMembership(inserted[0].id, ownerUserId);
  return inserted[0];
}

async function getOrgWorkspace(userId) {
  const { rows: owned } = await db.query(
    `SELECT id, owner_user_id, name FROM courses
     WHERE owner_user_id = $1 AND COALESCE(is_organization, FALSE) = TRUE
     ORDER BY created_at ASC LIMIT 1`,
    [userId],
  );
  if (owned[0]) {
    await ensureOwnerMembership(owned[0].id, userId);
    const { rows: teachers } = await db.query(
      `SELECT instructor_user_id FROM course_teachers WHERE course_id = $1 AND is_active = TRUE`,
      [owned[0].id],
    );
    for (const row of teachers) {
      if (String(row.instructor_user_id) === String(userId)) continue;
      await ensureStaffMembership(owned[0].id, row.instructor_user_id, ORG_ROLE_KEYS.INSTRUCTOR);
    }
    const { rows: mem } = await db.query(
      `SELECT role_key FROM org_memberships WHERE course_id = $1 AND user_id = $2 LIMIT 1`,
      [owned[0].id, userId],
    );
    const roleKey = mem[0]?.role_key || ORG_ROLE_KEYS.OWNER;
    return {
      course: owned[0],
      roleKey,
      permissions: permissionsForRole(roleKey),
      isOwner: true,
    };
  }

  const { rows: membership } = await db.query(
    `SELECT m.course_id, m.role_key, c.owner_user_id, c.name
     FROM org_memberships m
     JOIN courses c ON c.id = m.course_id
     WHERE m.user_id = $1 AND COALESCE(c.is_organization, FALSE) = TRUE
     ORDER BY CASE WHEN m.role_key = 'owner' THEN 0 ELSE 1 END, m.created_at ASC
     LIMIT 1`,
    [userId],
  );
  if (membership[0]) {
    return {
      course: {
        id: membership[0].course_id,
        owner_user_id: membership[0].owner_user_id,
        name: membership[0].name,
      },
      roleKey: membership[0].role_key,
      permissions: permissionsForRole(membership[0].role_key),
      isOwner: String(membership[0].owner_user_id) === String(userId),
    };
  }

  const course = await ensureOrgCourseForOwner(userId);
  return {
    course,
    roleKey: ORG_ROLE_KEYS.OWNER,
    permissions: permissionsForRole(ORG_ROLE_KEYS.OWNER),
    isOwner: true,
  };
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
     WHERE cs.course_id = $1 AND cs.archived_at IS NULL AND COALESCE(u.is_active, TRUE) = TRUE`,
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

  await ensureStaffMembership(course.id, instructor.id, ORG_ROLE_KEYS.INSTRUCTOR);
  await writeOrgAudit({
    courseId: course.id,
    actorUserId: ownerUserId,
    action: 'user.invited',
    targetType: 'trainer',
    targetId: instructor.id,
    metadata: { phone: instructor.phone, name: instructor.full_name },
  });

  return {
    id: instructor.id,
    full_name: instructor.full_name,
    phone: instructor.phone,
    status: rows[0].status,
    is_owner: false,
    course_students_count: 0,
  };
}

async function getOrgSettingsByCourse(course) {
  const ownerUserId = course.owner_user_id;
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
  return getOrgSettingsByCourse(course);
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
  await writeOrgAudit({
    courseId: course.id,
    actorUserId: ownerUserId,
    action: 'organization.settings_changed',
    targetType: 'organization',
    targetId: course.id,
    metadata: { course_name: courseName },
  });

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
  await writeOrgAudit({
    courseId: (await ensureOrgCourseForOwner(ownerUserId)).id,
    actorUserId: ownerUserId,
    action: 'organization.settings_changed',
    targetType: 'organization',
    metadata: { field: 'logo' },
  });
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

async function findStudentUserByPhone(cleanPhone) {
  const user = await findUserByPhone(cleanPhone);
  if (!user) return null;
  if (await userHasRole(user.id, 'student')) return user;
  const { rows } = await db.query(
    `SELECT 1 FROM users WHERE id = $1 AND role = 'student' AND COALESCE(is_active, TRUE) = TRUE LIMIT 1`,
    [user.id],
  );
  return rows.length ? user : null;
}

async function listOrgStudents(courseId) {
  const { rows } = await db.query(
    `SELECT u.id, u.full_name, u.phone, cs.enrollment_id, cs.created_at,
            e.instructor_id, iu.full_name AS instructor_name,
            cg.id AS group_id, cg.name AS group_name
     FROM course_students cs
     INNER JOIN users u ON u.id = cs.student_id
     LEFT JOIN enrollments e ON e.id = cs.enrollment_id AND e.deleted_at IS NULL
     LEFT JOIN users iu ON iu.id = e.instructor_id
     LEFT JOIN LATERAL (
       SELECT g.id, g.name
       FROM course_group_members cgm
       INNER JOIN course_groups g ON g.id = cgm.group_id AND g.course_id = cs.course_id AND g.is_active = TRUE
         AND g.instructor_group_id IS NULL
       WHERE cgm.student_id = cs.student_id
       ORDER BY g.name
       LIMIT 1
     ) cg ON TRUE
     WHERE cs.course_id = $1 AND cs.archived_at IS NULL AND COALESCE(u.is_active, TRUE) = TRUE
     ORDER BY u.full_name`,
    [courseId],
  );
  return rows;
}

async function addOrgStudent(ownerUserId, phone) {
  const course = await ensureOrgCourseForOwner(ownerUserId);
  const clean = normalizePhone(phone);
  if (!clean) {
    const err = new Error('Telefon nömrəsi tələb olunur');
    err.statusCode = 400;
    throw err;
  }

  const student = await findStudentUserByPhone(clean);
  if (!student) {
    const err = new Error(
      'İştirakçı tapılmadı, zəhmət olmasa əvvəlcə onun platformada qeydiyyatdan keçdiyinə əmin olun',
    );
    err.statusCode = 404;
    throw err;
  }

  const { rows: existing } = await db.query(
    `SELECT archived_at FROM course_students WHERE course_id = $1 AND student_id = $2`,
    [course.id, student.id],
  );
  if (existing.length && !existing[0].archived_at) {
    const err = new Error('Bu iştirakçı artıq təşkilatdadır');
    err.statusCode = 409;
    throw err;
  }
  if (existing.length && existing[0].archived_at) {
    await db.query(
      `UPDATE course_students SET archived_at = NULL WHERE course_id = $1 AND student_id = $2`,
      [course.id, student.id],
    );
  } else {
    const { rows: enr } = await db.query(
      `SELECT e.id FROM enrollments e
       INNER JOIN course_teachers ct ON ct.instructor_user_id = e.instructor_id AND ct.course_id = $1 AND ct.is_active = TRUE AND ct.status = 'ACTIVE'
       WHERE e.student_id = $2 AND e.deleted_at IS NULL
       ORDER BY e.enrolled_at DESC NULLS LAST
       LIMIT 1`,
      [course.id, student.id],
    );
    const enrollmentId = enr[0]?.id || null;
    await db.query(
      `INSERT INTO course_students (course_id, student_id, enrollment_id)
       VALUES ($1, $2, $3)`,
      [course.id, student.id, enrollmentId],
    );
  }

  await writeOrgAudit({
    courseId: course.id,
    actorUserId: ownerUserId,
    action: 'user.invited',
    targetType: 'participant',
    targetId: student.id,
    metadata: { name: student.full_name },
  });

  const list = await listOrgStudents(course.id);
  return list.find((s) => String(s.id) === String(student.id)) || {
    id: student.id,
    full_name: student.full_name,
    phone: student.phone,
  };
}

async function listOrgGroups(courseId) {
  const { rows } = await db.query(
    `SELECT cg.id, cg.name, cg.instructor_user_id, cg.sort_order, cg.created_at, cg.team_id,
            u.full_name AS instructor_name,
            t.name AS team_name,
            (SELECT COUNT(*)::int FROM course_group_members cgm WHERE cgm.group_id = cg.id) AS member_count
     FROM course_groups cg
     LEFT JOIN users u ON u.id = cg.instructor_user_id
     LEFT JOIN org_teams t ON t.id = cg.team_id AND t.course_id = cg.course_id
     WHERE cg.course_id = $1 AND cg.is_active = TRUE AND cg.instructor_group_id IS NULL
     ORDER BY cg.sort_order ASC, cg.name ASC`,
    [courseId],
  );
  return rows;
}

async function createOrgGroup(courseId, ownerUserId, body) {
  const name = String(body?.name || '').trim();
  if (!name) {
    const err = new Error('Qrup adı tələb olunur');
    err.statusCode = 400;
    throw err;
  }

  const instructorUserId = body?.instructor_user_id || null;
  if (instructorUserId) {
    const { rows: ct } = await db.query(
      `SELECT 1 FROM course_teachers
       WHERE course_id = $1 AND instructor_user_id = $2 AND is_active = TRUE AND status = 'ACTIVE'`,
      [courseId, instructorUserId],
    );
    if (!ct.length) {
      const err = new Error('Seçilmiş müəllim bu kursun heyətində deyil');
      err.statusCode = 400;
      throw err;
    }
  }

  let teamId = body?.team_id || null;
  if (teamId) {
    const { rows: team } = await db.query(
      `SELECT id FROM org_teams WHERE id = $1 AND course_id = $2 AND is_active = TRUE`,
      [teamId, courseId],
    );
    if (!team[0]) {
      const err = new Error('Komanda tapılmadı');
      err.statusCode = 400;
      throw err;
    }
    teamId = team[0].id;
  }

  const { rows } = await db.query(
    `INSERT INTO course_groups (course_id, name, instructor_user_id, instructor_group_id, sort_order, team_id)
     VALUES ($1, $2, $3, NULL, COALESCE($4::int, 0), $5)
     RETURNING id`,
    [courseId, name, instructorUserId, body?.sort_order != null ? Number(body.sort_order) : 0, teamId],
  );
  await writeOrgAudit({
    courseId,
    actorUserId: ownerUserId,
    action: 'group.created',
    targetType: 'group',
    targetId: rows[0].id,
    metadata: { name },
  });
  const groups = await listOrgGroups(courseId);
  return groups.find((g) => String(g.id) === String(rows[0].id)) || rows[0];
}

async function listOrgTeachers(courseId, ownerUserId) {
  const { rows } = await db.query(
    `SELECT ct.instructor_user_id AS id, u.full_name, u.phone, u.email, u.last_activity_at,
            ct.status, ct.is_active,
            (ct.instructor_user_id = $2) AS is_owner,
            m.role_key,
            t.id AS team_id,
            t.name AS team_name,
            (
              SELECT COUNT(DISTINCT cs.student_id)::int
              FROM course_students cs
              WHERE cs.course_id = $1
                AND cs.enrollment_id IN (
                  SELECT e.id FROM enrollments e
                  WHERE e.instructor_id = ct.instructor_user_id AND e.deleted_at IS NULL
                )
            ) AS course_students_count,
            (
              SELECT COUNT(*)::int FROM exams e
              WHERE e.instructor_id = ct.instructor_user_id AND COALESCE(e.is_deleted, FALSE) = FALSE
            ) AS created_assessments_count
     FROM course_teachers ct
     INNER JOIN users u ON u.id = ct.instructor_user_id
     LEFT JOIN org_memberships m ON m.course_id = ct.course_id AND m.user_id = ct.instructor_user_id
     LEFT JOIN LATERAL (
       SELECT ot.id, ot.name
       FROM org_team_members otm
       JOIN org_teams ot ON ot.id = otm.team_id AND ot.course_id = ct.course_id AND ot.is_active = TRUE
       WHERE otm.user_id = ct.instructor_user_id AND otm.member_kind = 'trainer'
       ORDER BY ot.name
       LIMIT 1
     ) t ON TRUE
     WHERE ct.course_id = $1
     ORDER BY ct.is_active DESC, u.full_name`,
    [courseId, ownerUserId],
  );
  return rows;
}

async function setOrgTeacherActive(courseId, trainerUserId, isActive, actorUserId) {
  if (String(trainerUserId) === String(actorUserId)) {
    const err = new Error('Öz hesabınızı dayandıra bilməzsiniz');
    err.statusCode = 400;
    throw err;
  }
  const { rows } = await db.query(
    `UPDATE course_teachers
     SET is_active = $3
     WHERE course_id = $1 AND instructor_user_id = $2
     RETURNING instructor_user_id`,
    [courseId, trainerUserId, Boolean(isActive)],
  );
  if (!rows[0]) {
    const err = new Error('Müəllim tapılmadı');
    err.statusCode = 404;
    throw err;
  }
  await writeOrgAudit({
    courseId,
    actorUserId,
    action: isActive ? 'trainer.activated' : 'trainer.suspended',
    targetType: 'trainer',
    targetId: trainerUserId,
  });
  return listOrgTeachers(courseId, actorUserId);
}

async function removeOrgTeacher(courseId, trainerUserId, actorUserId) {
  if (String(trainerUserId) === String(actorUserId)) {
    const err = new Error('Öz hesabınızı silə bilməzsiniz');
    err.statusCode = 400;
    throw err;
  }
  const { rows } = await db.query(
    `DELETE FROM course_teachers
     WHERE course_id = $1 AND instructor_user_id = $2
     RETURNING instructor_user_id`,
    [courseId, trainerUserId],
  );
  if (!rows[0]) {
    const err = new Error('Müəllim tapılmadı');
    err.statusCode = 404;
    throw err;
  }
  await removeMembership(courseId, trainerUserId);
  await writeOrgAudit({
    courseId,
    actorUserId,
    action: 'user.removed',
    targetType: 'trainer',
    targetId: trainerUserId,
  });
}

module.exports = {
  LEAD_STATUSES,
  TEACHER_STATUSES,
  INSTRUCTOR_NOT_FOUND_MSG,
  ensureOrgCourseForOwner,
  getOrgWorkspace,
  assertOrgCourseOwner,
  getOrgSettings,
  getOrgSettingsByCourse,
  updateOrgSettings,
  updateOrgLogo,
  getOrgDashboardStats,
  listLeads,
  createLead,
  updateLead,
  listOrgTeachers,
  addOrgTeacher,
  setOrgTeacherActive,
  removeOrgTeacher,
  listOrgStudents,
  addOrgStudent,
  listOrgGroups,
  createOrgGroup,
};

