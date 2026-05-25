/**
 * Silinmiş / deaktiv tələbəyə yeni ödəniş və təsdiq əməliyyatları bağlanır.
 */
async function loadActiveEnrollmentForPayments(db, enrollmentId, { instructorUserId, userRole } = {}) {
  const { rows } = await db.query(
    `SELECT e.id, e.instructor_id, e.student_id, e.billing_type, e.billing_cycle, e.lesson_count,
            e.course_id, e.enrollment_start_date, e.enrolled_at, e.deleted_at,
            u.full_name, u.phone, u.is_active,
            sp.monthly_fee,
            to_char(sp.payment_start_date::date, 'YYYY-MM-DD') AS payment_start_date
     FROM enrollments e
     INNER JOIN users u ON u.id = e.student_id
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     WHERE e.id = $1
       AND e.deleted_at IS NULL
       AND u.deleted_at IS NULL
       AND u.is_active = TRUE`,
    [enrollmentId]
  );
  const en = rows[0];
  if (!en) {
    const err = new Error('Qeydiyyat tapılmadı və ya tələbə silinib — yeni ödəniş əlavə oluna bilməz');
    err.statusCode = 404;
    throw err;
  }
  if (userRole === 'instructor' && instructorUserId) {
    const iid = String(instructorUserId).trim().toLowerCase().replace(/-/g, '');
    const eid = String(en.instructor_id).trim().toLowerCase().replace(/-/g, '');
    if (iid !== eid) {
      const err = new Error('İcazə yoxdur');
      err.statusCode = 403;
      throw err;
    }
  }
  return en;
}

module.exports = { loadActiveEnrollmentForPayments };
