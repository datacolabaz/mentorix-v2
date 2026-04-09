const db = require('../utils/db');

const listStudents = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const { rows } = await db.query(
      `SELECT u.id, u.full_name, u.email, u.phone,
              sp.parent_id, sp.grade,
              pu.full_name AS parent_name, pu.phone AS parent_phone,
              e.id AS enrollment_id, e.billing_type, e.lesson_count,
              e.status AS enrollment_status, e.referral_notes,
              e.instructor_id, iu.full_name AS instructor_name,
              rs.name AS referral_source,
              ROUND(AVG(a.session_score)) AS avg_score
       FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       LEFT JOIN users pu ON pu.id = sp.parent_id
       LEFT JOIN enrollments e ON e.student_id = u.id
       LEFT JOIN users iu ON iu.id = e.instructor_id
       LEFT JOIN referral_sources rs ON rs.id = e.referral_source_id
       LEFT JOIN attendance a ON a.enrollment_id = e.id AND a.attended = TRUE
       WHERE u.role = 'student' AND u.is_active = TRUE
         AND ($1 OR e.instructor_id = $2)
       GROUP BY u.id, sp.parent_id, sp.grade, pu.full_name, pu.phone,
                e.id, e.billing_type, e.lesson_count, e.status,
                e.referral_notes, e.instructor_id, iu.full_name, rs.name
       ORDER BY u.full_name`,
      [isAdmin, req.user.id]
    );
    res.json({ success: true, students: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getStudent = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.*, sp.parent_id, sp.grade, sp.notes,
              pu.full_name AS parent_name, pu.phone AS parent_phone
       FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       LEFT JOIN users pu ON pu.id = sp.parent_id
       WHERE u.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    res.json({ success: true, student: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteStudent = async (req, res) => {
  try {
    await db.query('DELETE FROM enrollments WHERE id=$1', [req.params.enrollmentId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { listStudents, getStudent, deleteStudent };
