const db = require('../utils/db');

const listStudents = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const instructorId =
      req.user.id != null ? String(req.user.id).trim().toLowerCase().replace(/-/g, '') : '';

    const select = `SELECT u.id, u.full_name, u.email, u.phone,
              sp.parent_id, sp.grade,
              sp.monthly_fee, sp.payment_day,
              COALESCE(NULLIF(TRIM(sp.parent_name), ''), pu.full_name) AS parent_name,
              COALESCE(NULLIF(TRIM(sp.parent_phone), ''), pu.phone) AS parent_phone,
              e.id AS enrollment_id, e.billing_type, e.lesson_count,
              e.status AS enrollment_status, e.referral_notes,
              e.instructor_id, iu.full_name AS instructor_name,
              rs.name AS referral_source,
              ROUND(AVG(a.session_score)) AS avg_score`;

    const joins = `FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       LEFT JOIN users pu ON pu.id = sp.parent_id
       LEFT JOIN enrollments e ON e.student_id = u.id
       LEFT JOIN users iu ON iu.id = e.instructor_id
       LEFT JOIN referral_sources rs ON rs.id = e.referral_source_id
       LEFT JOIN attendance a ON a.enrollment_id = e.id AND a.attended = TRUE`;

    const group = `GROUP BY u.id, u.full_name, u.email, u.phone, sp.parent_id, sp.grade,
                sp.monthly_fee, sp.payment_day,
                sp.parent_name, sp.parent_phone, pu.full_name, pu.phone,
                e.id, e.billing_type, e.lesson_count, e.status,
                e.referral_notes, e.instructor_id, iu.full_name, rs.name
       ORDER BY u.full_name`;

    if (!isAdmin) {
      if (!instructorId) {
        return res.status(400).json({ success: false, message: 'İstifadəçi identifikatoru yoxdur' });
      }
      const { rows } = await db.query(
        `${select}
         ${joins}
         WHERE u.role = 'student' AND u.is_active = TRUE
           AND e.id IS NOT NULL
           AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1
         ${group}`,
        [instructorId]
      );
      return res.json({ success: true, students: rows });
    }

    const { rows } = await db.query(
      `${select}
       ${joins}
       WHERE u.role = 'student' AND u.is_active = TRUE
       ${group}`
    );
    res.json({ success: true, students: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getStudent = async (req, res) => {
  try {
    if (req.user.role === 'student' && String(req.params.id) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const { rows } = await db.query(
      `SELECT u.*, sp.parent_id, sp.grade, sp.notes,
              sp.monthly_fee, sp.payment_day,
              pu.full_name AS parent_name, pu.phone AS parent_phone,
              e.id AS enrollment_id, e.billing_type, e.lesson_count,
              e.status AS enrollment_status, e.enrolled_at AS enrollment_started_at,
              iu.full_name AS instructor_name
       FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       LEFT JOIN users pu ON pu.id = sp.parent_id
       LEFT JOIN LATERAL (
         SELECT e2.* FROM enrollments e2
         WHERE e2.student_id = u.id AND e2.status = 'active'
         ORDER BY e2.enrolled_at DESC NULLS LAST
         LIMIT 1
       ) e ON TRUE
       LEFT JOIN users iu ON iu.id = e.instructor_id
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
