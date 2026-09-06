/**
 * Tələbələrim siyahısı və billing usage.students eyni dəsti saymalıdır:
 * aktiv tələbə hesabı + silinməmiş enrollment.
 * Gizli: pending_setup imtahan/tapşırıq qonaqları (GET /students də onları çıxarır).
 */

function instructorIdHexExpr(col) {
  return `REPLACE(LOWER(TRIM(${col}::text)), '-', '')`;
}

/**
 * @param {{ instructorParam?: number, hexParamAlreadyNormalized?: boolean }} [opts]
 */
function instructorVisibleStudentsWhereSql(opts = {}) {
  const instructorParam = opts.instructorParam == null ? 1 : opts.instructorParam;
  const instructorMatch = opts.hexParamAlreadyNormalized
    ? `${instructorIdHexExpr('e.instructor_id')} = $${instructorParam}`
    : `${instructorIdHexExpr('e.instructor_id')} = ${instructorIdHexExpr(`$${instructorParam}`)}`;
  return `
    u.role = 'student'
    AND u.is_active = TRUE
    AND u.deleted_at IS NULL
    AND e.deleted_at IS NULL
    AND e.id IS NOT NULL
    AND ${instructorMatch}
    AND NOT (
      COALESCE(LOWER(TRIM(e.status)), '') = 'pending_setup'
      AND COALESCE(LOWER(TRIM(e.enrollment_source)), '') IN ('exam', 'task')
    )
  `;
}

function enrollmentCountsTowardStudentUsage(row) {
  if (!row) return false;
  if (row.user_role != null && String(row.user_role).trim().toLowerCase() !== 'student') return false;
  if (row.user_is_active === false) return false;
  if (row.user_deleted_at) return false;
  if (row.enrollment_deleted_at) return false;
  if (!row.enrollment_id && row.enrollment_id !== 0 && !row.id) return false;
  const st = String(row.status || row.enrollment_status || '').trim().toLowerCase();
  const src = String(row.enrollment_source || 'manual').trim().toLowerCase();
  if (st === 'pending_setup' && (src === 'exam' || src === 'task')) return false;
  return true;
}

module.exports = {
  instructorIdHexExpr,
  instructorVisibleStudentsWhereSql,
  enrollmentCountsTowardStudentUsage,
};
