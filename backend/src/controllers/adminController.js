const bcrypt = require('bcryptjs');
const db = require('../utils/db');
const { normalizePlanSlug } = require('../config/plans');

function normalizeAdminEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
}
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
      `SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.is_verified, u.created_at,
              (u.password_hash IS NOT NULL) AS has_password,
              (COALESCE(TRIM(u.google_sub::text), '') <> '') AS has_google,
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

/** Admin: müəllim email + şifrə təyin et (email boş hesablar üçün giriş bərpası). */
const patchInstructorProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, phone, subject, email, new_password } = req.body || {};

    const { rows: u } = await db.query(
      `SELECT id, role FROM users WHERE id = $1 AND role = 'instructor' LIMIT 1`,
      [id],
    );
    if (!u[0]) return res.status(404).json({ success: false, message: 'Müəllim tapılmadı' });

    if (full_name != null && String(full_name).trim()) {
      await db.query('UPDATE users SET full_name = $1 WHERE id = $2', [String(full_name).trim(), id]);
    }
    if (phone !== undefined) {
      const p = phone != null && String(phone).trim() ? String(phone).trim() : null;
      await db.query('UPDATE users SET phone = $1 WHERE id = $2', [p, id]);
    }
    if (subject !== undefined) {
      const subj = subject != null ? String(subject).trim() : null;
      const { rowCount } = await db.query(
        'UPDATE instructor_profiles SET subject = $1 WHERE user_id = $2',
        [subj, id],
      );
      if (rowCount === 0) {
        await db.query('INSERT INTO instructor_profiles (user_id, subject) VALUES ($1, $2)', [id, subj]);
      }
    }

    if (email !== undefined) {
      const raw = String(email || '').trim();
      if (!raw) {
        await db.query(
          `UPDATE users SET email = NULL WHERE id = $1`,
          [id],
        );
      } else {
        const emailCanon = normalizeAdminEmail(raw);
        if (!emailCanon) {
          return res.status(400).json({ success: false, message: 'Email formatı düzgün deyil' });
        }
        const { rows: clash } = await db.query(
          `SELECT id FROM users
           WHERE is_active = TRUE
             AND id <> $1
             AND email IS NOT NULL
             AND LOWER(TRIM(email)) = $2
           LIMIT 1`,
          [id, emailCanon],
        );
        if (clash[0]) {
          return res.status(409).json({ success: false, message: 'Bu email başqa hesabda istifadə olunur' });
        }
        await db.query(
          `UPDATE users
           SET email = $2,
               is_verified = TRUE,
               account_status = CASE
                 WHEN account_status IN ('pending_google', 'pending') THEN 'active'
                 ELSE COALESCE(account_status, 'active')
               END
           WHERE id = $1`,
          [id, emailCanon],
        );
      }
    }

    if (new_password != null && String(new_password).trim() !== '') {
      const pass = String(new_password);
      if (pass.length < 8) {
        return res.status(400).json({ success: false, message: 'Şifrə ən azı 8 simvol olmalıdır' });
      }
      const hash = await bcrypt.hash(pass, 12);
      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id]);
    }

    const { rows: out } = await db.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.is_verified,
              (u.password_hash IS NOT NULL) AS has_password,
              (COALESCE(TRIM(u.google_sub::text), '') <> '') AS has_google,
              ip.subject
       FROM users u
       LEFT JOIN instructor_profiles ip ON ip.user_id = u.id
       WHERE u.id = $1`,
      [id],
    );

    res.json({ success: true, instructor: out[0] || null });
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
    const [
      instructors,
      studentsTotal,
      studentsEnrolled,
      classes,
      subscriptions,
      tuitionRevenue,
      platformRevenue,
      exams,
      unassignedStudents,
    ] = await Promise.all([
      db.query(
        `SELECT COUNT(*)::int AS count
         FROM users
         WHERE role = 'instructor' AND is_active = TRUE AND deleted_at IS NULL`
      ),
      db.query(
        `SELECT COUNT(*)::int AS count
         FROM users
         WHERE role = 'student' AND deleted_at IS NULL`
      ),
      db.query(
        `SELECT COUNT(DISTINCT e.student_id)::int AS count
         FROM enrollments e
         ${ACTIVE_ENROLLMENT_JOIN_INLINE}`
      ),
      db.query(`SELECT COUNT(*)::int AS count FROM instructor_groups`),
      db.query(
        `SELECT COUNT(*)::int AS count
         FROM subscriptions
         WHERE LOWER(TRIM(COALESCE(status, ''))) = 'active'`
      ),
      db.query(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM payments
         WHERE status = 'completed'
           AND (deleted_at IS NULL)
           AND (notes IS NULL OR TRIM(notes) NOT LIKE '[Balans düzəlişi]%')`
      ),
      db.query(
        `SELECT COALESCE(SUM(amount_cents), 0)::bigint AS total_cents
         FROM billing_payments
         WHERE LOWER(TRIM(status)) = 'paid'`
      ),
      db.query(
        `SELECT COUNT(*)::int AS count
         FROM exams
         WHERE COALESCE(is_deleted, FALSE) = FALSE`
      ),
      db.query(
        `SELECT COUNT(*)::int AS count
         FROM users u
         WHERE u.role = 'student'
           AND u.deleted_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM enrollments e
             WHERE e.student_id = u.id
               AND e.deleted_at IS NULL
               AND COALESCE(e.status, 'active') = 'active'
               AND e.instructor_id IS NOT NULL
           )`
      ),
    ]);

    const tuition = parseFloat(tuitionRevenue.rows[0].total) || 0;
    const platform = (Number(platformRevenue.rows[0].total_cents) || 0) / 100;

    res.json({
      success: true,
      stats: {
        instructors: parseInt(instructors.rows[0].count, 10),
        students: parseInt(studentsTotal.rows[0].count, 10),
        students_enrolled: parseInt(studentsEnrolled.rows[0].count, 10),
        students_unassigned: parseInt(unassignedStudents.rows[0].count, 10),
        classes: parseInt(classes.rows[0].count, 10),
        subscriptions: parseInt(subscriptions.rows[0].count, 10),
        exams: parseInt(exams.rows[0].count, 10),
        revenue: tuition + platform,
        revenue_tuition: tuition,
        revenue_platform: platform,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const buildStudentListQuery = (filters) => {
  const params = [];
  const where = [`u.role = 'student'`, `u.deleted_at IS NULL`];

  if (filters.q) {
    params.push(`%${filters.q}%`);
    const i = params.length;
    where.push(`(
      u.full_name ILIKE $${i}
      OR COALESCE(u.email, '') ILIKE $${i}
      OR COALESCE(u.phone, '') ILIKE $${i}
    )`);
  }

  if (filters.instructor) {
    params.push(`%${filters.instructor}%`);
    where.push(`COALESCE(iu.full_name, '') ILIKE $${params.length}`);
  }

  if (filters.className) {
    params.push(`%${filters.className}%`);
    where.push(`COALESCE(ig.name, '') ILIKE $${params.length}`);
  }

  if (filters.status === 'active') where.push('u.is_active = TRUE');
  if (filters.status === 'inactive') where.push('u.is_active = FALSE');

  if (filters.unassigned === 'true' || filters.unassigned === '1') {
    where.push(`e.id IS NULL`);
  } else if (filters.unassigned === 'false' || filters.unassigned === '0') {
    where.push(`e.id IS NOT NULL`);
  }

  const sql = `
    SELECT
      u.id,
      u.full_name,
      u.email,
      u.phone,
      u.is_active,
      u.is_verified,
      u.created_at,
      e.id AS enrollment_id,
      e.status AS enrollment_status,
      e.instructor_id,
      iu.full_name AS instructor_name,
      e.group_id,
      ig.name AS group_name,
      ig.join_code AS group_join_code,
      (e.id IS NULL) AS is_unassigned
    FROM users u
    LEFT JOIN LATERAL (
      SELECT e2.*
      FROM enrollments e2
      WHERE e2.student_id = u.id
        AND e2.deleted_at IS NULL
        AND COALESCE(e2.status, 'active') = 'active'
        AND e2.instructor_id IS NOT NULL
      ORDER BY e2.id DESC
      LIMIT 1
    ) e ON TRUE
    LEFT JOIN users iu ON iu.id = e.instructor_id AND iu.deleted_at IS NULL
    LEFT JOIN instructor_groups ig ON ig.id = e.group_id
    WHERE ${where.join(' AND ')}
    ORDER BY u.created_at DESC NULLS LAST, u.full_name ASC`;

  return { sql, params };
};

const getStudents = async (req, res) => {
  try {
    const filters = {
      q: String(req.query.q || req.query.name || '').trim() || null,
      instructor: String(req.query.instructor || req.query.teacher || '').trim() || null,
      className: String(req.query.class || req.query.course || '').trim() || null,
      status: String(req.query.status || '').trim().toLowerCase() || null,
      unassigned: req.query.unassigned != null ? String(req.query.unassigned) : null,
    };
    const { sql, params } = buildStudentListQuery(filters);
    const { rows } = await db.query(sql, params);
    res.json({ success: true, students: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getStudentById = async (req, res) => {
  try {
    const id = req.params.id;
    const { rows: users } = await db.query(
      `SELECT id, full_name, email, phone, is_active, is_verified, created_at
       FROM users
       WHERE id = $1 AND role = 'student' AND deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    if (!users[0]) {
      return res.status(404).json({ success: false, message: 'Tələbə tapılmadı' });
    }

    const { rows: enrollments } = await db.query(
      `SELECT
         e.id,
         e.status,
         e.enrollment_start_date,
         e.instructor_id,
         iu.full_name AS instructor_name,
         iu.phone AS instructor_phone,
         e.group_id,
         ig.name AS group_name,
         ig.join_code AS group_join_code,
         ist.name AS subject_name
       FROM enrollments e
       LEFT JOIN users iu ON iu.id = e.instructor_id
       LEFT JOIN instructor_groups ig ON ig.id = e.group_id
       LEFT JOIN instructor_subjects ist ON ist.id = e.subject_id
       WHERE e.student_id = $1 AND e.deleted_at IS NULL
       ORDER BY e.id DESC`,
      [id],
    );

    const { rows: profileRows } = await db.query(
      `SELECT parent_name, parent_phone, parent_email, grade, school
       FROM student_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [id],
    ).catch(() => ({ rows: [] }));

    const active = enrollments.find((e) => String(e.status || 'active').toLowerCase() === 'active');
    res.json({
      success: true,
      student: users[0],
      profile: profileRows[0] || null,
      enrollments,
      link: active
        ? {
            instructor_id: active.instructor_id,
            instructor_name: active.instructor_name,
            group_id: active.group_id,
            group_name: active.group_name,
            join_code: active.group_join_code,
          }
        : null,
      is_unassigned: !active,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const toggleStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const isActive = req.body?.is_active;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'is_active (boolean) tələb olunur' });
    }
    const { rows } = await db.query(
      `UPDATE users SET is_active = $1
       WHERE id = $2 AND role = 'student' AND deleted_at IS NULL
       RETURNING id, is_active`,
      [isActive, id],
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Tələbə tapılmadı' });
    }
    res.json({ success: true, student: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteStudent = async (req, res) => {
  try {
    const studentId = String(req.params.id || '').trim();
    if (!studentId) return res.status(400).json({ success: false, message: 'ID tələb olunur' });

    const { rows: u } = await db.query(
      `SELECT id FROM users WHERE id = $1 AND role = 'student' AND deleted_at IS NULL LIMIT 1`,
      [studentId],
    );
    if (!u[0]) return res.status(404).json({ success: false, message: 'Tələbə tapılmadı' });

    await db.transaction(async (client) => {
      // Collect enrollments first (needed for per-enrollment tables)
      const { rows: enrRows } = await client.query(
        `SELECT id FROM enrollments WHERE student_id = $1`,
        [studentId],
      );
      const enrollmentIds = enrRows.map((r) => r.id).filter(Boolean);

      if (enrollmentIds.length) {
        // lessons & related
        await client.query('DELETE FROM attendance WHERE enrollment_id = ANY($1::uuid[])', [enrollmentIds]).catch(() => {});
        await client.query('DELETE FROM enrollment_lessons WHERE enrollment_id = ANY($1::uuid[])', [enrollmentIds]).catch(() => {});
        await client.query('DELETE FROM monthly_attendance_slots WHERE enrollment_id = ANY($1::uuid[])', [enrollmentIds]).catch(() => {});
        await client.query('DELETE FROM lessons WHERE enrollment_id = ANY($1::uuid[])', [enrollmentIds]).catch(() => {});
        await client.query('DELETE FROM payments WHERE enrollment_id = ANY($1::uuid[])', [enrollmentIds]).catch(() => {});
        await client.query('DELETE FROM enrollments WHERE id = ANY($1::uuid[])', [enrollmentIds]).catch(() => {});
      }

      // Student-scoped tables
      await client.query('DELETE FROM student_assignments WHERE student_id = $1', [studentId]).catch(() => {});
      await client.query('DELETE FROM student_prep_slots WHERE student_id = $1', [studentId]).catch(() => {});
      await client.query('DELETE FROM exam_results WHERE student_id = $1', [studentId]).catch(() => {});
      await client.query('DELETE FROM exam_assignments WHERE student_id = $1', [studentId]).catch(() => {});
      await client.query('DELETE FROM notifications WHERE user_id = $1', [studentId]).catch(() => {});
      await client.query('DELETE FROM student_profiles WHERE user_id = $1', [studentId]).catch(() => {});

      // Billing/subscription artifacts linked by user_id (optional, but requested: delete everything)
      await client.query('DELETE FROM subscriptions WHERE user_id = $1', [studentId]).catch(() => {});
      await client.query('DELETE FROM billing_payments WHERE user_id = $1', [studentId]).catch(() => {});
      await client.query('DELETE FROM billing_history WHERE user_id = $1', [studentId]).catch(() => {});
      await client.query('DELETE FROM trials WHERE user_id = $1', [studentId]).catch(() => {});
      await client.query('DELETE FROM usage_counters WHERE user_id = $1', [studentId]).catch(() => {});

      // Finally delete user row
      await client.query('DELETE FROM users WHERE id = $1', [studentId]);
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getClasses = async (req, res) => {
  try {
    const filters = {
      q: String(req.query.q || '').trim() || null,
      instructor: String(req.query.instructor || req.query.teacher || '').trim() || null,
    };
    const params = [];
    const where = ['TRUE'];

    if (filters.q) {
      params.push(`%${filters.q}%`);
      where.push(`ig.name ILIKE $${params.length}`);
    }
    if (filters.instructor) {
      params.push(`%${filters.instructor}%`);
      where.push(`iu.full_name ILIKE $${params.length}`);
    }

    const { rows } = await db.query(
      `SELECT
         ig.id,
         ig.name,
         ig.join_code,
         ig.join_code_expires_at,
         ig.created_at,
         ig.instructor_id,
         iu.full_name AS instructor_name,
         iu.phone AS instructor_phone,
         COALESCE(NULLIF(TRIM(ist.name), ''), 'Sahəsiz') AS subject,
         COALESCE(cnt.n, 0)::int AS student_count
       FROM instructor_groups ig
       JOIN users iu ON iu.id = ig.instructor_id AND iu.deleted_at IS NULL
       LEFT JOIN instructor_subjects ist ON ist.id = ig.subject_id
       LEFT JOIN (
         SELECT e.group_id, COUNT(DISTINCT e.student_id) AS n
         FROM enrollments e
         JOIN users su ON su.id = e.student_id AND su.role = 'student' AND su.deleted_at IS NULL
         WHERE e.deleted_at IS NULL
           AND COALESCE(e.status, 'active') = 'active'
           AND e.group_id IS NOT NULL
         GROUP BY e.group_id
       ) cnt ON cnt.group_id = ig.id
       WHERE ${where.join(' AND ')}
       ORDER BY ig.created_at DESC NULLS LAST, ig.name ASC`,
      params,
    );
    res.json({ success: true, classes: rows });
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

module.exports = {
  getInstructors,
  patchInstructorProfile,
  updateInstructorLimits,
  updateInstructorPlan,
  getDashboardStats,
  toggleInstructor,
  getStudents,
  getStudentById,
  toggleStudent,
  deleteStudent,
  getClasses,
};
