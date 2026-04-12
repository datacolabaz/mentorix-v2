const db = require('../utils/db');

function normUuid(id) {
  return String(id).trim().toLowerCase().replace(/-/g, '');
}

function sameUuid(a, b) {
  if (a == null || b == null) return false;
  return normUuid(a) === normUuid(b);
}

/** Tələbə: öz enrollment ödənişləri + aktiv paket məlumatı */
const listMyPayments = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { rows: payments } = await db.query(
      `SELECT p.id, p.amount, p.currency, p.payment_method, p.status, p.period, p.notes, p.paid_at, p.payment_date,
              e.billing_type, e.lesson_count AS enrollment_lesson_count,
              iu.full_name AS instructor_name
       FROM payments p
       INNER JOIN enrollments e ON e.id = p.enrollment_id AND e.student_id = $1
       LEFT JOIN users iu ON iu.id = e.instructor_id
       ORDER BY p.paid_at DESC NULLS LAST`,
      [studentId]
    );

    const { rows: enRows } = await db.query(
      `SELECT e.*, iu.full_name AS instructor_name
       FROM enrollments e
       LEFT JOIN users iu ON iu.id = e.instructor_id
       WHERE e.student_id = $1 AND e.status = 'active'
       ORDER BY e.enrolled_at DESC NULLS LAST
       LIMIT 1`,
      [studentId]
    );

    res.json({ success: true, payments, enrollment: enRows[0] || null });
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
    const { rows: en } = await db.query('SELECT student_id FROM enrollments WHERE id = $1', [enrollment_id]);
    const studentId = en[0]?.student_id || null;
    const payDate = payment_date || null;
    const { rows } = await db.query(
      `INSERT INTO payments (enrollment_id, student_id, amount, payment_method, period, notes, status, payment_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [enrollment_id, studentId, amount, payment_method, period, notes, status || 'completed', payDate]
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
              sp.monthly_fee, sp.payment_day,
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
        payment_day: r.payment_day,
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
