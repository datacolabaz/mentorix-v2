const db = require('../utils/db');

// Butun muellimler
const getInstructors = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.is_active,
              ip.subject, ip.billing_type, ip.sms_limit, ip.sms_used,
              ip.storage_limit_mb, ip.storage_used_mb,
              ip.ram_limit_mb, ip.max_concurrent_students,
              COUNT(e.id) AS student_count
       FROM users u
       LEFT JOIN instructor_profiles ip ON ip.user_id = u.id
       LEFT JOIN enrollments e ON e.instructor_id = u.id AND e.status = 'active'
       WHERE u.role = 'instructor' AND u.is_active = TRUE
       GROUP BY u.id, ip.id
       ORDER BY u.full_name`
    );
    res.json({ success: true, instructors: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Muellim limitlerini yenile
const updateInstructorLimits = async (req, res) => {
  try {
    const { id } = req.params;
    const { sms_limit, storage_limit_mb, ram_limit_mb, max_concurrent_students } = req.body;

    await db.query(
      `UPDATE instructor_profiles
       SET sms_limit=$1, storage_limit_mb=$2, ram_limit_mb=$3, max_concurrent_students=$4
       WHERE user_id=$5`,
      [sms_limit, storage_limit_mb, ram_limit_mb, max_concurrent_students, id]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin dashboard stats
const getDashboardStats = async (req, res) => {
  try {
    const [instructors, students, payments] = await Promise.all([
      db.query("SELECT COUNT(*) FROM users WHERE role='instructor' AND is_active=TRUE"),
      db.query("SELECT COUNT(*) FROM users WHERE role='student' AND is_active=TRUE"),
      db.query(
        `SELECT COALESCE(SUM(amount),0) AS total FROM payments
         WHERE status='completed'
           AND (notes IS NULL OR TRIM(notes) NOT LIKE '[Balans düzəlişi]%')`
      ),
    ]);

    res.json({
      success: true,
      stats: {
        instructors: parseInt(instructors.rows[0].count),
        students: parseInt(students.rows[0].count),
        revenue: parseFloat(payments.rows[0].total),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Muellimi aktiv/deaktiv et
const toggleInstructor = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    await db.query('UPDATE users SET is_active=$1 WHERE id=$2', [is_active, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getInstructors, updateInstructorLimits, getDashboardStats, toggleInstructor };
