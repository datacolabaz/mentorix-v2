/**
 * Aktiv tələbə qeydiyyatı — müəllim paneli, landing və admin statistikada eyni məntiq.
 */
const ACTIVE_ENROLLMENT_JOIN_INLINE = `
  JOIN users su ON su.id = e.student_id AND su.role = 'student' AND su.is_active = TRUE AND su.deleted_at IS NULL
  JOIN users iu ON iu.id = e.instructor_id AND iu.role = 'instructor' AND iu.is_active = TRUE AND iu.deleted_at IS NULL
  WHERE e.deleted_at IS NULL
    AND COALESCE(e.status, 'active') = 'active'`;

const ACTIVE_ENROLLMENT_WHERE = `
  e.deleted_at IS NULL
  AND COALESCE(e.status, 'active') = 'active'`;

const ACTIVE_STUDENT_USER_JOIN = `
  JOIN users su ON su.id = e.student_id
    AND su.role = 'student'
    AND su.is_active = TRUE
    AND su.deleted_at IS NULL`;

module.exports = {
  ACTIVE_ENROLLMENT_JOIN_INLINE,
  ACTIVE_ENROLLMENT_WHERE,
  ACTIVE_STUDENT_USER_JOIN,
};
