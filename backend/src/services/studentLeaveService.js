/** Statuses a student can leave — matches Qruplarım plus paused. */
const STUDENT_LEAVEABLE_STATUSES = ['active', 'pending_setup', 'pending_approval', 'paused'];

function notFound() {
  const err = new Error('Aktiv qeydiyyat tapılmadı');
  err.statusCode = 404;
  return err;
}

/**
 * Mark the student's enrollment as left and reject any PENDING join request
 * so the group disappears from Qruplarım and the teacher's approval queue.
 */
async function leaveEnrollmentForStudent(studentId, enrollmentId, deps = {}) {
  const dbConn = deps.db || require('../utils/db');
  const syncUsage = deps.syncUsage || require('./usageStudentsSync').syncUsageStudentsCount;
  if (!studentId || !enrollmentId) throw notFound();

  const left = await dbConn.transaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE enrollments
       SET status = 'left'
       WHERE id = $1
         AND student_id = $2
         AND (deleted_at IS NULL)
         AND COALESCE(LOWER(TRIM(status)), 'active') = ANY($3::text[])
       RETURNING id, instructor_id`,
      [enrollmentId, studentId, STUDENT_LEAVEABLE_STATUSES],
    );
    const row = rows[0];
    if (!row) return null;

    await client.query(
      `UPDATE student_join_requests
       SET status = 'REJECTED',
           resolved_at = NOW(),
           resolved_by = $2,
           rejection_reason = 'Tələbə qrupdan ayrıldı'
       WHERE enrollment_id = $1
         AND UPPER(TRIM(status)) = 'PENDING'`,
      [row.id, studentId],
    );

    return row;
  });

  if (!left) throw notFound();
  await Promise.resolve(syncUsage(left.instructor_id)).catch(() => {});
  return left;
}

module.exports = {
  STUDENT_LEAVEABLE_STATUSES,
  leaveEnrollmentForStudent,
};
