const db = require('../utils/db');
const {
  computeSubscriptionState,
  computePrepaidWallet,
  getTodayBakuYmd,
  loadInstructorMonthlySubscriptionFinancials,
  loadInstructorMonthlyPrepaidFinancials,
  roundMoney,
  timingIsPrepaid,
  toYmd: anchorToYmd,
} = require('../services/subscriptionBilling');

function normUuid(id) {
  return String(id).trim().toLowerCase().replace(/-/g, '');
}

function sameUuid(a, b) {
  if (a == null || b == null) return false;
  return normUuid(a) === normUuid(b);
}

/**
 * Köhnə DB CHECK-ləri çox vaxt 'manual' qəbul etmir; nağd kimi saxlanır (detal notes-da).
 */
function paymentMethodForDb(raw) {
  if (raw == null || String(raw).trim() === '') return 'cash';
  const m = String(raw).trim().toLowerCase();
  if (m === 'manual') return 'cash';
  return m.length <= 50 ? m : m.slice(0, 50);
}

/** DATE / timestamptz → YYYY-MM-DD (UTC tarix hissəsi; DATE artıq gün kimi gəlir) */
function toYmd(v) {
  if (v == null) return null;
  const s = String(v);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
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
    let lessonStartForDisplay = null;
    if (enrollment) {
      const { student_monthly_fee, ...rest } = enrollment;
      lessonStartForDisplay = rest.enrollment_start_date || null;
      const mfNum = student_monthly_fee != null ? Number(student_monthly_fee) : NaN;
      const startYmd = toYmd(rest.enrollment_start_date);
      const enrolledYmd = toYmd(rest.enrolled_at);
      const preSystemEnrollment =
        Boolean(startYmd && enrolledYmd && startYmd < enrolledYmd);
      enrollmentOut = {
        ...rest,
        monthly_fee: Number.isFinite(mfNum) ? mfNum : null,
        enrolled_at: rest.enrolled_at || null,
        pre_system_enrollment: preSystemEnrollment,
      };
      if (rest.billing_type === 'monthly' && Number.isFinite(mfNum) && mfNum > 0 && enrollmentOut.id) {
        const anchorYmd = anchorToYmd(lessonStartForDisplay);
        if (anchorYmd) {
          const todayBaku = await getTodayBakuYmd(db);
          const { rows: pr } = await db.query(
            `SELECT COALESCE(SUM(amount), 0)::numeric AS t
             FROM payments
             WHERE enrollment_id = $1 AND status = 'completed'`,
            [enrollmentOut.id]
          );
          const paid = Number(pr[0]?.t) || 0;
          if (timingIsPrepaid(rest.billing_timing)) {
            const { rows: sl } = await db.query(
              `SELECT COUNT(*)::int AS n
               FROM monthly_attendance_slots
               WHERE enrollment_id = $1
                 AND lesson_date <= $2::date
                 AND charges_virtual_balance = TRUE`,
              [enrollmentOut.id, todayBaku]
            );
            const charged = Number(sl[0]?.n) || 0;
            enrollmentOut.subscription = computePrepaidWallet(mfNum, charged, paid);
          } else {
            enrollmentOut.subscription = computeSubscriptionState(anchorYmd, todayBaku, mfNum, paid);
          }
        }
      }
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
            lesson_start_date_for_display: lessonStartForDisplay,
            payment_start_date_for_display: lessonStartForDisplay,
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
    const { enrollment_id, amount, payment_method, period, notes, status, payment_date, legacy_kind } = req.body;
    if (!enrollment_id) {
      return res.status(400).json({ success: false, message: 'enrollment_id tələb olunur' });
    }
    const { rows: en } = await db.query(
      'SELECT student_id, billing_type, billing_cycle, instructor_id FROM enrollments WHERE id = $1',
      [enrollment_id]
    );
    if (!en[0]) return res.status(404).json({ success: false, message: 'Qeydiyyat tapılmadı' });
    if (req.user.role === 'instructor' && !sameUuid(en[0].instructor_id, req.user.id)) {
      return res.status(403).json({ success: false, message: 'Bu qeydiyyata ödəniş əlavə etmək üçün icazəniz yoxdur' });
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ success: false, message: 'Məbləğ müsbət rəqəm olmalıdır' });
    }
    const studentId = en[0]?.student_id || null;
    const cycle = en[0]?.billing_cycle != null ? Number(en[0].billing_cycle) : null;
    const bt = en[0]?.billing_type || null;
    const payDate = payment_date || null;
    const derivedPeriod =
      !period && (bt === '8_lessons' || bt === '12_lessons') && cycle != null ? `Dövr #${cycle}` : period;
    let notesOut = notes != null && String(notes).trim() !== '' ? String(notes).trim() : null;
    if (legacy_kind === 'initial_balance') {
      notesOut = `[Başlanğıc balansı]${notesOut ? ` ${notesOut}` : ''}`;
    } else if (legacy_kind === 'past_payment') {
      notesOut = `[Keçmiş ödəniş qeydi]${notesOut ? ` ${notesOut}` : ''}`;
    }
    const { rows } = await db.query(
      `INSERT INTO payments (enrollment_id, student_id, amount, payment_method, period, billing_cycle, notes, status, payment_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        enrollment_id,
        studentId,
        amt,
        paymentMethodForDb(payment_method),
        derivedPeriod,
        cycle,
        notesOut,
        status || 'completed',
        payDate,
      ]
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
              e.billing_type AS enrollment_billing_type,
              e.billing_timing,
              sp.monthly_fee,
              e.enrollment_start_date::date AS lesson_start_date,
              (e.enrollment_start_date IS NOT NULL
                AND e.enrolled_at IS NOT NULL
                AND e.enrollment_start_date::date < (e.enrolled_at::date)) AS pre_system_enrollment
       FROM enrollments e
       INNER JOIN users u ON u.id = e.student_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE u.role = 'student' AND u.is_active = TRUE
         AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1
       ORDER BY u.full_name`,
      [iid]
    );

    const { byEnrollment: subMap, pendingSum: postpaidPending } =
      await loadInstructorMonthlySubscriptionFinancials(db, iid);
    const { byEnrollment: preMap, pendingSum: prepaidPending } = await loadInstructorMonthlyPrepaidFinancials(db, iid);
    const pendingAmount = roundMoney(postpaidPending + prepaidPending);

    let pendingCount = 0;
    const students = rows.map((r) => {
      const feeNum = r.monthly_fee != null ? Number(r.monthly_fee) : NaN;
      const hasFee = Number.isFinite(feeNum) && feeNum > 0;
      const parts = String(r.full_name || '')
        .trim()
        .split(/\s+/);
      const firstName = parts[0] || '—';
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '—';
      let paymentStatus = 'təyin_edilməyib';
      let sub = null;
      let prepaidExtras = null;
      const anchorYmd = anchorToYmd(r.lesson_start_date);
      const isPrepaid = timingIsPrepaid(r.billing_timing);
      if (r.enrollment_billing_type === 'monthly' && hasFee && anchorYmd) {
        if (isPrepaid) {
          const pv = preMap.get(String(r.enrollment_id));
          if (pv) {
            sub = {
              billing_model: 'prepaid',
              subscription_months: pv.subscription_months,
              subscription_due_total: pv.subscription_due_total,
              subscription_total_paid: pv.subscription_total_paid,
              pending_debt: pv.pending_debt,
              subscription_prepaid: pv.subscription_prepaid,
            };
            prepaidExtras = {
              lesson_unit_price: pv.lesson_unit_price,
              charged_lesson_count: pv.charged_lesson_count,
              consumed_amount: pv.consumed_amount,
              wallet_balance: pv.wallet_balance,
            };
          }
        } else {
          const vb = subMap.get(String(r.enrollment_id));
          if (vb) {
            sub = {
              billing_model: 'postpaid',
              subscription_months: vb.subscription_months,
              subscription_due_total: vb.subscription_due_total,
              subscription_total_paid: vb.subscription_total_paid,
              pending_debt: vb.pending_debt,
              subscription_prepaid: vb.subscription_prepaid,
            };
          }
        }
        if (sub && sub.pending_debt > 0.005) pendingCount += 1;
        if (sub) paymentStatus = sub.pending_debt > 0.005 ? 'gözlənilir' : 'ödənilib';
      }
      return {
        enrollment_id: r.enrollment_id,
        student_id: r.student_id,
        first_name: firstName,
        last_name: lastName,
        phone: r.phone,
        billing_type: r.enrollment_billing_type,
        billing_timing: r.billing_timing || 'postpaid',
        monthly_fee: r.monthly_fee,
        lesson_start_date: r.lesson_start_date,
        payment_start_date: r.lesson_start_date,
        payment_status: paymentStatus,
        pre_system_enrollment: Boolean(r.pre_system_enrollment),
        subscription_months: sub?.subscription_months ?? null,
        subscription_due_total: sub?.subscription_due_total ?? null,
        subscription_total_paid: sub?.subscription_total_paid ?? null,
        pending_debt: sub?.pending_debt ?? null,
        subscription_prepaid: sub?.subscription_prepaid ?? null,
        billing_model: sub?.billing_model ?? null,
        lesson_unit_price: prepaidExtras?.lesson_unit_price ?? null,
        charged_lesson_count: prepaidExtras?.charged_lesson_count ?? null,
        consumed_amount: prepaidExtras?.consumed_amount ?? null,
        wallet_balance: prepaidExtras?.wallet_balance ?? null,
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

/** Aylıq virtual balans: istənilən məbləğ (defolt: aylıq məbləğ) */
const markMonthlyPaid = async (req, res) => {
  try {
    const { enrollment_id, amount: amountRaw } = req.body;
    if (!enrollment_id) {
      return res.status(400).json({ success: false, message: 'enrollment_id tələb olunur' });
    }

    const { rows: en } = await db.query(
      `SELECT e.id, e.student_id, e.instructor_id, e.billing_type, sp.monthly_fee
       FROM enrollments e
       LEFT JOIN student_profiles sp ON sp.user_id = e.student_id
       WHERE e.id = $1`,
      [enrollment_id]
    );
    if (!en[0]) return res.status(404).json({ success: false, message: 'Qeydiyyat tapılmadı' });

    if (req.user.role === 'instructor' && !sameUuid(en[0].instructor_id, req.user.id)) {
      return res.status(403).json({ success: false, message: 'Bu qeydiyyata icazəniz yoxdur' });
    }

    if (en[0].billing_type !== 'monthly') {
      return res.status(400).json({ success: false, message: 'Bu əməliyyat yalnız aylıq paket üçün keçərlidir' });
    }

    const defaultFee = Number(en[0].monthly_fee);
    const parsed = amountRaw !== undefined && amountRaw !== '' && amountRaw != null ? Number(amountRaw) : NaN;
    const amount = Number.isFinite(parsed) && parsed > 0 ? parsed : defaultFee;
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Məbləğ müsbət rəqəm olmalıdır' });
    }

    const { rows: ins } = await db.query(
      `INSERT INTO payments (enrollment_id, student_id, amount, currency, payment_method, status, paid_at, payment_date, notes)
       VALUES ($1, $2, $3, 'AZN', 'cash', 'completed', NOW(),
               (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date,
               $4)
       RETURNING *`,
      [enrollment_id, en[0].student_id, amount, 'Aylıq abunə ödənişi']
    );
    res.json({ success: true, payment: ins[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getEnrollmentPaymentHistory = async (req, res) => {
  try {
    const { enrollment_id } = req.params;
    const { rows: en } = await db.query(
      `SELECT e.instructor_id, e.student_id FROM enrollments e WHERE e.id = $1`,
      [enrollment_id]
    );
    if (!en[0]) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    if (req.user.role === 'instructor' && !sameUuid(en[0].instructor_id, req.user.id)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }
    if (req.user.role === 'student' && !sameUuid(en[0].student_id, req.user.id)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }
    if (req.user.role !== 'instructor' && req.user.role !== 'admin' && req.user.role !== 'student') {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const { rows } = await db.query(
      `SELECT id, amount, currency, payment_method, status, payment_date, paid_at, notes, period
       FROM payments
       WHERE enrollment_id = $1
       ORDER BY COALESCE(paid_at, payment_date::timestamptz) DESC NULLS LAST, id DESC`,
      [enrollment_id]
    );
    res.json({ success: true, payments: rows });
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
  getEnrollmentPaymentHistory,
};
