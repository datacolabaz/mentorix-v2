const db = require('../utils/db');

function normUuid(id) {
  return String(id).trim().toLowerCase().replace(/-/g, '');
}

function sameUuid(a, b) {
  if (a == null || b == null) return false;
  return normUuid(a) === normUuid(b);
}

function billingLimit(type) {
  if (type === '8_lessons') return 8;
  if (type === '12_lessons') return 12;
  return null;
}

/** Tələbə: öz enrollment ödənişləri + aktiv paket məlumatı */
const listMyPayments = async (req, res) => {
  try {
    const studentId = req.user.id;
    if (!studentId) {
      return res.status(401).json({ success: false, message: 'İstifadəçi tapılmadı' });
    }

    let payments = [];
    try {
      const { rows } = await db.query(
        `SELECT p.id, p.amount, p.currency, p.payment_method, p.status, p.period, p.notes, p.paid_at, p.payment_date,
                p.billing_cycle,
                e.billing_type, e.lesson_count AS enrollment_lesson_count, e.billing_cycle AS enrollment_billing_cycle,
                iu.full_name AS instructor_name
         FROM payments p
         INNER JOIN enrollments e ON e.id = p.enrollment_id AND e.student_id = $1
         LEFT JOIN users iu ON iu.id = e.instructor_id
         ORDER BY p.paid_at DESC NULLS LAST`,
        [studentId]
      );
      payments = rows;
    } catch (payErr) {
      console.error('listMyPayments: payments query failed', payErr);
      payments = [];
    }

    const { rows: enRows } = await db.query(
      `SELECT e.*,
              iu.full_name AS instructor_name,
              sp.payment_start_date AS student_payment_start_date,
              sp.monthly_fee AS student_monthly_fee
       FROM enrollments e
       LEFT JOIN users iu ON iu.id = e.instructor_id
       LEFT JOIN student_profiles sp ON sp.user_id = e.student_id
       WHERE e.student_id = $1
         AND (
           NULLIF(TRIM(COALESCE(e.status, '')), '') IS NULL
           OR LOWER(TRIM(e.status)) = 'active'
         )
       ORDER BY e.enrolled_at DESC NULLS LAST, e.id DESC
       LIMIT 1`,
      [studentId]
    );

    let enrollment = enRows[0] || null;
    if (!enrollment) {
      const { rows: anyRows } = await db.query(
        `SELECT e.*,
                iu.full_name AS instructor_name,
                sp.payment_start_date AS student_payment_start_date,
                sp.monthly_fee AS student_monthly_fee
         FROM enrollments e
         LEFT JOIN users iu ON iu.id = e.instructor_id
         LEFT JOIN student_profiles sp ON sp.user_id = e.student_id
         WHERE e.student_id = $1
         ORDER BY e.enrolled_at DESC NULLS LAST, e.id DESC
         LIMIT 1`,
        [studentId]
      );
      enrollment = anyRows[0] || null;
    }
    let enrollmentOut = null;
    let paymentStartForDisplay = null;
    if (enrollment) {
      const { student_payment_start_date, student_monthly_fee, ...rest } = enrollment;
      paymentStartForDisplay = student_payment_start_date || null;
      const mfNum = student_monthly_fee != null ? Number(student_monthly_fee) : NaN;
      enrollmentOut = {
        ...rest,
        monthly_fee: Number.isFinite(mfNum) ? mfNum : null,
      };
    }
    const limit = enrollment ? billingLimit(enrollment.billing_type) : null;
    const remaining_lessons =
      enrollment && limit != null ? Math.max(0, Number(limit) - Number(enrollment.lesson_count || 0)) : null;

    let nextLesson = null;
    let planned_lessons_in_cycle = null;
    if (enrollment && limit != null) {
      const cycle = enrollment.billing_cycle || 1;
      const { rows: nl } = await db.query(
        `SELECT lesson_date
         FROM lessons
         WHERE student_id = $1
           AND enrollment_id = $2
           AND billing_cycle = $3
           AND status = 'pending'
         ORDER BY lesson_date
         LIMIT 1`,
        [studentId, enrollment.id, cycle]
      );
      nextLesson = nl[0]?.lesson_date || null;

      const { rows: c } = await db.query(
        `SELECT COUNT(*)::int AS n
         FROM lessons
         WHERE student_id = $1
           AND enrollment_id = $2
           AND billing_cycle = $3`,
        [studentId, enrollment.id, cycle]
      );
      planned_lessons_in_cycle = c[0]?.n ?? null;
    }

    res.json({
      success: true,
      payments,
      enrollment: enrollmentOut
        ? {
            ...enrollmentOut,
            lesson_limit: limit,
            remaining_lessons,
            next_lesson_at: nextLesson,
            planned_lessons_in_cycle: planned_lessons_in_cycle,
            payment_start_date_for_display: paymentStartForDisplay,
          }
        : null,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const listPayments = async (req, res) => {
  try {
    let sql = `SELECT p.*, u.full_name AS student_name
       FROM payments p
       JOIN enrollments e ON e.id = p.enrollment_id
       JOIN users u ON u.id = e.student_id`;
    const params = [];
    if (req.user.role === 'instructor') {
      sql += ` WHERE REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1`;
      params.push(normUuid(req.user.id));
    }
    sql += ` ORDER BY p.paid_at DESC`;
    const { rows } = await db.query(sql, params);
    res.json({ success: true, payments: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const addPayment = async (req, res) => {
  try {
    const { enrollment_id, amount, payment_method, period, notes, status, payment_date } = req.body;
    const { rows: en } = await db.query(
      'SELECT student_id, billing_type, billing_cycle FROM enrollments WHERE id = $1',
      [enrollment_id]
    );
    const studentId = en[0]?.student_id || null;
    const cycle = en[0]?.billing_cycle != null ? Number(en[0].billing_cycle) : null;
    const bt = en[0]?.billing_type || null;
    const payDate = payment_date || null;
    const derivedPeriod =
      !period && (bt === '8_lessons' || bt === '12_lessons') && cycle != null ? `Dövr #${cycle}` : period;
    const { rows } = await db.query(
      `INSERT INTO payments (enrollment_id, student_id, amount, payment_method, period, billing_cycle, notes, status, payment_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [enrollment_id, studentId, amount, payment_method, derivedPeriod, cycle, notes, status || 'completed', payDate]
    );
    res.json({ success: true, payment: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Müəllim: ümumi gəlir, gözlənilən ödənişlər, tələbə cədvəli */
const getInstructorPaymentBoard = async (req, res) => {
  try {
    const iid = normUuid(req.user.id);

    const { rows: sumRows } = await db.query(
      `SELECT COALESCE(SUM(p.amount), 0)::numeric AS total
       FROM payments p
       INNER JOIN enrollments e ON e.id = p.enrollment_id
       WHERE p.status = 'completed'
         AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1`,
      [iid]
    );

    const { rows } = await db.query(
      `SELECT e.id AS enrollment_id, u.id AS student_id, u.full_name, u.phone,
              sp.monthly_fee, sp.payment_start_date,
              EXISTS (
                SELECT 1 FROM payments p2
                WHERE p2.enrollment_id = e.id
                  AND p2.status = 'completed'
                  AND date_trunc('month', COALESCE(p2.payment_date, p2.paid_at::date)::timestamp)
                    = date_trunc('month', CURRENT_DATE::timestamp)
              ) AS paid_this_month
       FROM enrollments e
       INNER JOIN users u ON u.id = e.student_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE u.role = 'student' AND u.is_active = TRUE
         AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1
       ORDER BY u.full_name`,
      [iid]
    );

    let pendingCount = 0;
    let pendingAmount = 0;
    const students = rows.map((r) => {
      const feeNum = r.monthly_fee != null ? Number(r.monthly_fee) : NaN;
      const hasFee = Number.isFinite(feeNum) && feeNum > 0;
      const pending = hasFee && !r.paid_this_month;
      if (pending) {
        pendingCount += 1;
        pendingAmount += feeNum;
      }
      const parts = String(r.full_name || '')
        .trim()
        .split(/\s+/);
      const firstName = parts[0] || '—';
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '—';
      let paymentStatus = 'təyin_edilməyib';
      if (hasFee) {
        paymentStatus = r.paid_this_month ? 'ödənilib' : 'gözlənilir';
      }
      return {
        enrollment_id: r.enrollment_id,
        student_id: r.student_id,
        first_name: firstName,
        last_name: lastName,
        phone: r.phone,
        monthly_fee: r.monthly_fee,
        payment_start_date: r.payment_start_date,
        payment_status: paymentStatus,
      };
    });

    res.json({
      success: true,
      totalEarnings: Number(sumRows[0].total) || 0,
      pendingCount,
      pendingAmount,
      students,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const markMonthlyPaid = async (req, res) => {
  try {
    const { enrollment_id } = req.body;
    if (!enrollment_id) {
      return res.status(400).json({ success: false, message: 'enrollment_id tələb olunur' });
    }

    const { rows: en } = await db.query(
      `SELECT e.id, e.student_id, e.instructor_id, sp.monthly_fee
       FROM enrollments e
       LEFT JOIN student_profiles sp ON sp.user_id = e.student_id
       WHERE e.id = $1`,
      [enrollment_id]
    );
    if (!en[0]) return res.status(404).json({ success: false, message: 'Qeydiyyat tapılmadı' });

    if (req.user.role === 'instructor' && !sameUuid(en[0].instructor_id, req.user.id)) {
      return res.status(403).json({ success: false, message: 'Bu qeydiyyata icazəniz yoxdur' });
    }

    const amount = Number(en[0].monthly_fee);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Aylıq məbləğ təyin edilməyib' });
    }

    const { rows: dup } = await db.query(
      `SELECT id FROM payments
       WHERE enrollment_id = $1 AND status = 'completed'
         AND date_trunc('month', COALESCE(payment_date, paid_at::date)::timestamp)
           = date_trunc('month', CURRENT_DATE::timestamp)
       LIMIT 1`,
      [enrollment_id]
    );
    if (dup[0]) {
      return res.json({ success: true, alreadyPaid: true, message: 'Bu ay üçün ödəniş artıq qeydə alınıb' });
    }

    const { rows: ins } = await db.query(
      `INSERT INTO payments (enrollment_id, student_id, amount, currency, status, paid_at, payment_date, notes)
       VALUES ($1, $2, $3, 'AZN', 'completed', NOW(), CURRENT_DATE, $4)
       RETURNING *`,
      [enrollment_id, en[0].student_id, amount, 'Aylıq ödəniş']
    );
    res.json({ success: true, payment: ins[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  listPayments,
  addPayment,
  listMyPayments,
  getInstructorPaymentBoard,
  markMonthlyPaid,
};
