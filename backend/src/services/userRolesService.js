const db = require('../utils/db');

const PHONE_NORM = "regexp_replace(COALESCE(phone::text, ''), '[^0-9]', '', 'g')";

const LOGIN_ROLES = ['instructor', 'student', 'parent', 'course'];

async function getActiveRoles(userId) {
  const { rows } = await db.query(
    `SELECT role FROM user_roles
     WHERE user_id = $1 AND is_active = TRUE
     ORDER BY
       CASE role
         WHEN 'instructor' THEN 1
         WHEN 'course' THEN 2
         WHEN 'student' THEN 3
         WHEN 'parent' THEN 4
         ELSE 9
       END`,
    [userId],
  );
  return rows.map((r) => r.role);
}

async function userHasRole(userId, role) {
  const { rows } = await db.query(
    `SELECT 1 FROM user_roles WHERE user_id = $1 AND role = $2 AND is_active = TRUE LIMIT 1`,
    [userId, role],
  );
  return rows.length > 0;
}

async function grantUserRole(userId, role, client = null) {
  const q = client ? client.query.bind(client) : db.query.bind(db);
  await q(
    `INSERT INTO user_roles (user_id, role, is_active)
     VALUES ($1, $2, TRUE)
     ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE`,
    [userId, role],
  );
}

/** Telefon üzrə tək aktiv istifadəçi (users.phone UNIQUE) */
async function findUserByPhone(cleanPhone) {
  const { rows } = await db.query(
    `SELECT * FROM users WHERE ${PHONE_NORM} = $1 AND COALESCE(is_active, TRUE) = TRUE LIMIT 1`,
    [cleanPhone],
  );
  return rows[0] || null;
}

/**
 * Kurs rolü ver + course_profiles (mövcud müəllim üçün).
 */
async function grantCourseRoleToUser(userId, courseName = null) {
  await grantUserRole(userId, 'course');
  const { rows } = await db.query(`SELECT full_name FROM users WHERE id = $1`, [userId]);
  const name = courseName || rows[0]?.full_name || 'Kurs';
  await db.query(
    `INSERT INTO course_profiles (user_id, course_name)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET course_name = COALESCE(EXCLUDED.course_name, course_profiles.course_name), updated_at = NOW()`,
    [userId, name],
  );
}

/** Müəllim hesabı varsa, Kurs panelinə giriş üçün course rolunu avtomatik verir. */
async function isInstructorAccount(userId) {
  if (await userHasRole(userId, 'instructor')) return true;
  const { rows: legacy } = await db.query(
    `SELECT 1 FROM users WHERE id = $1 AND role = 'instructor' AND COALESCE(is_active, TRUE) = TRUE LIMIT 1`,
    [userId],
  );
  if (legacy.length) return true;
  const { rows: prof } = await db.query(
    `SELECT 1 FROM instructor_profiles WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  return prof.length > 0;
}

async function ensureCourseRoleIfInstructor(userId, courseName = null) {
  if (!(await isInstructorAccount(userId))) return false;
  if (await userHasRole(userId, 'course')) return true;
  await grantCourseRoleToUser(userId, courseName);
  return true;
}

const LOGIN_ROLE_ORDER = ['instructor', 'course', 'student', 'parent'];

/**
 * Email/telefon girişində göstəriləcək rollar: user_roles + köhnə users.role +
 * aktiv enrollment (tələbə), valideyn əlaqəsi, müəllim → kurs paneli.
 */
async function getLoginEligibleRoles(userId) {
  await ensureCourseRoleIfInstructor(userId);

  const eligible = new Set(await getActiveRoles(userId));

  const { rows: userRows } = await db.query(
    `SELECT role, persona, onboarding_completed, role_selected
     FROM users
     WHERE id = $1 AND COALESCE(is_active, TRUE) = TRUE
     LIMIT 1`,
    [userId],
  );
  const legacyRole = userRows[0]?.role;
  const persona = String(userRows[0]?.persona || '').trim();
  // Placeholder users.role='student' before purpose choice must not unlock student login.
  // Partner purpose may keep placeholder auth role for session JWT (cabinet + secondary panel).
  if (legacyRole && LOGIN_ROLES.includes(legacyRole)) {
    if (legacyRole !== 'student' || persona === 'student' || persona === 'partner') {
      eligible.add(legacyRole);
    }
  }

  if (await isInstructorAccount(userId)) eligible.add('instructor');

  const { rows: studentProfile } = await db.query(
    `SELECT 1 FROM student_profiles WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  if (studentProfile.length) eligible.add('student');

  const { rows: activeEnrollment } = await db.query(
    `SELECT 1 FROM enrollments e
     WHERE e.student_id = $1
       AND e.status = 'active'
       AND e.deleted_at IS NULL
     LIMIT 1`,
    [userId],
  );
  if (activeEnrollment.length) eligible.add('student');

  const { rows: parentLink } = await db.query(
    `SELECT 1 FROM student_profiles sp
     INNER JOIN users u ON u.id = sp.user_id AND COALESCE(u.is_active, TRUE) = TRUE
     WHERE sp.parent_id = $1
     LIMIT 1`,
    [userId],
  );
  if (parentLink.length) eligible.add('parent');

  return LOGIN_ROLE_ORDER.filter((r) => eligible.has(r));
}

/** Seçilmiş rol hələ user_roles-da yoxdursa, girişdə saxla (infer edilmiş rollar). */
async function ensureLoginRoleGranted(userId, role) {
  if (!role || !LOGIN_ROLES.includes(role)) return;
  if (role === 'course') {
    await ensureCourseRoleIfInstructor(userId);
    return;
  }
  if (!(await userHasRole(userId, role))) {
    await grantUserRole(userId, role);
  }
}

module.exports = {
  LOGIN_ROLES,
  LOGIN_ROLE_ORDER,
  getActiveRoles,
  getLoginEligibleRoles,
  ensureLoginRoleGranted,
  userHasRole,
  grantUserRole,
  findUserByPhone,
  grantCourseRoleToUser,
  isInstructorAccount,
  ensureCourseRoleIfInstructor,
};
