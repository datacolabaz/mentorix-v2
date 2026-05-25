const db = require('../utils/db');
const { normalizePlanSlug } = require('../config/plans');
const {
  ACTIVE_ENROLLMENT_JOIN_INLINE,
  ACTIVE_ENROLLMENT_WHERE,
  ACTIVE_STUDENT_USER_JOIN,
} = require('../sql/activeEnrollments');
const { SMS_LOGS_MONTHLY_COUNT_SUBQUERY } = require('../sql/adminSmsUsage');

// Butun muellimler
const getInstructors = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.created_at,
              ip.subject, ip.billing_type,
              COALESCE(s.plan, 'basic') AS plan,
              GREATEST(
                COALESCE(uc.sms_used_monthly, 0),
                ${SMS_LOGS_MONTHLY_COUNT_SUBQUERY}
              )::int AS sms_used_monthly,
              sp.sms_limit AS sms_limit_monthly,
              COALESCE(uc.storage_used_mb, 0) AS storage_used_mb,
              COALESCE(uc.students_count, 0) AS students_used,
              sp.student_limit AS students_limit,
              (sp.storage_gb * 1024)::int AS storage_limit_mb,
              (
                SELECT COUNT(DISTINCT e.student_id)::int
                FROM enrollments e
                ${ACTIVE_STUDENT_USER_JOIN}
                WHERE e.instructor_id = u.id
                  AND ${ACTIVE_ENROLLMENT_WHERE}
              ) AS student_count
       FROM users u
       LEFT JOIN instructor_profiles ip ON ip.user_id = u.id
       LEFT JOIN subscriptions s ON s.user_id = u.id
       LEFT JOIN usage_counters uc ON uc.user_id = u.id
       LEFT JOIN subscription_plans sp ON sp.slug = COALESCE(s.plan, 'basic') AND sp.is_active = TRUE
       WHERE u.role = 'instructor' AND u.is_active = TRUE AND u.deleted_at IS NULL
       ORDER BY u.created_at DESC NULLS LAST, u.full_name`
    );
    const instructors = (rows || []).map((r) => ({
      ...r,
      sms_used: Number(r.sms_used_monthly) || 0,
      sms_limit: r.sms_limit_monthly,
    }));
    res.json({ success: true, instructors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Muellim limitlerini yenile
const updateInstructorLimits = async (req, res) => {
  return res.status(410).json({
    success: false,
    code: 'DEPRECATED',
    message: 'Manual limitlər deprecated-dir. Paket seçimi ilə idarə olunur.',
  });
};

// Muellimin paketini yenile (limits subscription_plans-dan gəlir)
const updateInstructorPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const planRaw = req.body?.plan;
    const plan = normalizePlanSlug(planRaw);

    // Ensure instructor exists
    const { rows: u } = await db.query(
      `SELECT id FROM users WHERE id = $1 AND role = 'instructor' LIMIT 1`,
      [id]
    );
    if (!u[0]?.id) return res.status(404).json({ success: false, message: 'Müəllim tapılmadı' });

    await db.query(
      `INSERT INTO subscriptions (user_id, plan, status)
       VALUES ($1, $2, 'active')
       ON CONFLICT (user_id) DO UPDATE SET plan = EXCLUDED.plan, status = 'active'`,
      [id, plan]
    );

    // Disable legacy trial if present (plan is now source of truth)
    await db.query(
      `UPDATE trials SET is_active = FALSE WHERE user_id = $1`,
      [id]
    ).catch(() => {});

    res.json({ success: true, plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin dashboard stats
const getDashboardStats = async (req, res) => {
  try {
    const [instructors, students, payments] = await Promise.all([
      db.query(
        `SELECT COUNT(*)::int AS count
         FROM users
         WHERE role = 'instructor' AND is_active = TRUE AND deleted_at IS NULL`
      ),
      db.query(
        `SELECT COUNT(DISTINCT e.student_id)::int AS count
         FROM enrollments e
         ${ACTIVE_ENROLLMENT_JOIN_INLINE}`
      ),
      db.query(
        `SELECT COALESCE(SUM(amount),0) AS total FROM payments
         WHERE status='completed'
           AND (deleted_at IS NULL)
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

module.exports = { getInstructors, updateInstructorLimits, updateInstructorPlan, getDashboardStats, toggleInstructor };
