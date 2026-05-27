const db = require('../utils/db');

const GROUP_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#6366f1',
  '#14b8a6',
];

function colorForGroup(groupId) {
  const s = String(groupId || 'default');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return GROUP_COLORS[Math.abs(h) % GROUP_COLORS.length];
}

async function listActiveEnrollmentsForStudent(studentId) {
  const { rows } = await db.query(
    `SELECT
       e.id AS enrollment_id,
       e.instructor_id,
       e.group_id,
       e.subject_id,
       e.status,
       e.enrolled_at,
       e.configured_at,
       e.enrollment_start_date,
       ig.name AS group_name,
       ig.join_code,
       COALESCE(NULLIF(TRIM(ist.name), ''), 'Sahəsiz') AS subject_name,
       u.full_name AS instructor_name,
       u.phone AS instructor_phone,
       COALESCE(cnt.n, 0)::int AS student_count
     FROM enrollments e
     LEFT JOIN instructor_groups ig ON ig.id = e.group_id
     LEFT JOIN instructor_subjects ist ON ist.id = e.subject_id
     LEFT JOIN users u ON u.id = e.instructor_id AND u.deleted_at IS NULL
     LEFT JOIN (
       SELECT e2.group_id, COUNT(DISTINCT e2.student_id) AS n
       FROM enrollments e2
       JOIN users su ON su.id = e2.student_id AND su.is_active = TRUE AND su.deleted_at IS NULL
       WHERE e2.deleted_at IS NULL
         AND COALESCE(LOWER(TRIM(e2.status)), 'active') = 'active'
         AND e2.group_id IS NOT NULL
       GROUP BY e2.group_id
     ) cnt ON cnt.group_id = e.group_id
     WHERE e.student_id = $1
       AND (e.deleted_at IS NULL)
       AND COALESCE(LOWER(TRIM(e.status)), 'active') IN ('active', 'pending_setup')
     ORDER BY e.enrolled_at DESC NULLS LAST, ig.name ASC NULLS LAST`,
    [studentId],
  );

  return rows.map((r) => ({
    ...r,
    join_date: r.enrollment_start_date || r.enrolled_at,
    color: colorForGroup(r.group_id || r.enrollment_id),
  }));
}

async function resolveEnrollmentScope(studentId, enrollmentId) {
  if (!enrollmentId) return null;
  const { rows } = await db.query(
    `SELECT id AS enrollment_id, instructor_id, group_id, subject_id
     FROM enrollments
     WHERE id = $1
       AND student_id = $2
       AND (deleted_at IS NULL)
       AND COALESCE(LOWER(TRIM(status)), 'active') IN ('active', 'pending_setup')
     LIMIT 1`,
    [enrollmentId, studentId],
  );
  return rows[0] || null;
}

module.exports = {
  GROUP_COLORS,
  colorForGroup,
  listActiveEnrollmentsForStudent,
  resolveEnrollmentScope,
};
