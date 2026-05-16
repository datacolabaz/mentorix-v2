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

module.exports = {
  LOGIN_ROLES,
  getActiveRoles,
  userHasRole,
  grantUserRole,
  findUserByPhone,
  grantCourseRoleToUser,
};
