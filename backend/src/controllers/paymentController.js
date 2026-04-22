const db = require('../utils/db');
const {
  computeMonthlyBalanceState,
  computeMonthlyCycleProgress,
  getTodayBakuYmd,
  loadInstructorMonthlyBalanceRows,
  roundMoney,
  toYmd: anchorToYmd,
} = require('../services/subscriptionBilling');

/** Bu qeydlər balansı azaldır; ümumi gəlir statistikasına daxil edilmir */
const SQL_EXCLUDE_BALANCE_ADJUSTMENT =
  "AND (p.notes IS NULL OR TRIM(p.notes) NOT LIKE '[Balans düzəlişi]%')";

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

async function ensureNotificationOnce({ user_id, type, title, body }) {
  // Dedupe: same user+type+body in last 45 days
  const { rows } = await db.query(
    `SELECT 1 FROM notifications
     WHERE user_id = $1
       AND type = $2
       AND body = $3
       AND created_at > NOW() - INTERVAL '45 days'
     LIMIT 1`,
    [user_id, type, body]
  );
  if (rows.length) return false;
  await db.query(
    `INSERT INTO notifications (user_id, title, body, type, is_read)
     VALUES ($1,$2,$3,$4,FALSE)`,
    [user_id, title, body, type]
  );
  return true;
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
         ORDER BY COALESCE(p.paid_at, p.payment_date::timestamptz) DESC NULLS LAST, p.id DESC`,
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
              sp.monthly_fee AS student_monthly_fee,
              COALESCE(NULLIF(TRIM(ip.public_label), ''), 'instructor') AS instructor_public_label
       FROM enrollments e
       LEFT JOIN users iu ON iu.id = e.instructor_id
       LEFT JOIN instructor_profiles ip ON ip.user_id = e.instructor_id
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
                sp.monthly_fee AS student_monthly_fee,
                COALESCE(NULLIF(TRIM(ip.public_label), ''), 'instructor') AS instructor_public_label
         FROM enrollments e
         LEFT JOIN users iu ON iu.id = e.instructor_id
         LEFT JOIN instructor_profiles ip ON ip.user_id = e.instructor_id
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
    let monthlyProgress = null;
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
        const todayBaku = await getTodayBakuYmd(db);
        const { rows: pr } = await db.query(
          `SELECT COALESCE(SUM(amount), 0)::numeric AS t
           FROM payments
           WHERE enrollment_id = $1 AND status = 'completed'`,
          [enrollmentOut.id]
        );
        const paid = Number(pr[0]?.t) || 0;
        enrollmentOut.subscription = computeMonthlyBalanceState({
          monthly_fee: mfNum,
          anchor_ymd: anchorYmd,
          today_ymd: todayBaku,
          total_paid: paid,
        });

        monthlyProgress = computeMonthlyCycleProgress({
          anchor_ymd: anchorYmd,
          today_ymd: todayBaku,
        });

        // Monthly subscription: 2 calendar days remaining notification (student + instructor)
        if (enrollmentOut.notifications_enabled === true && monthlyProgress?.days_remaining === 2) {
          const msg =
            'Hörmətli tələbə, aylıq abunəliyinizin bitməsinə 2 gün qalıb. Davam etmək üçün ödənişi yeniləməyiniz xahiş olunur.';

          await ensureNotificationOnce({
            user_id: enrollmentOut.student_id,
            type: 'billing_monthly_2d_student',
            title: 'Abunəlik bitir',
            body: msg,
          });

          if (enrollmentOut.instructor_id) {
            await ensureNotificationOnce({
              user_id: enrollmentOut.instructor_id,
              type: 'billing_monthly_2d_instructor',
              title: 'Abunəlik bitir',
              body: msg,
            });
          }
        }
      }
    }
    const limit = enrollment ? billingLimit(enrollment.billing_type) : null;
    let calendar_used_lessons = null;
    let calendar_total_lessons = null;
    let calendar_remaining_lessons = null;
    if (enrollment && limit != null) {
      const cycle = enrollment.billing_cycle || 1;
      /**
       * Calendar countdown must follow schedule “wall time” (lesson_times) not stored timestamptz hour.
       * We derive a scheduled_ts per lesson: (lesson_date's Baku YMD + lesson_times for that weekday) in Asia/Baku.
       */
      const { rows: agg } = await db.query(
        `WITH enr AS (
           SELECT id, lesson_times
           FROM enrollments
           WHERE id = $1
         ),
         l AS (
           SELECT
             lesson_date,
             to_char((lesson_date AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS ymd,
             EXTRACT(ISODOW FROM (lesson_date AT TIME ZONE 'Asia/Baku'))::int AS dow
           FROM lessons
           WHERE enrollment_id = $1 AND billing_cycle = $2
         ),
         sched AS (
           SELECT
             (
               (l.ymd || ' ' ||
                 COALESCE(
                   NULLIF(LEFT((enr.lesson_times ->> l.dow::text), 5), ''),
                   to_char((l.lesson_date AT TIME ZONE 'Asia/Baku')::time, 'HH24:MI')
                 ) || ':00'
               )::timestamp AT TIME ZONE 'Asia/Baku'
             ) AS scheduled_ts
           FROM l
           CROSS JOIN enr
         )
         SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE scheduled_ts <= NOW())::int AS used
         FROM sched`,
        [enrollment.id, cycle]
      );
      const total = agg[0]?.total ?? 0;
      const used = agg[0]?.used ?? 0;
      calendar_total_lessons = Number(total) || 0;
      calendar_used_lessons = Math.min(calendar_total_lessons, Math.max(0, Number(used) || 0));
      calendar_remaining_lessons = Math.max(0, calendar_total_lessons - calendar_used_lessons);
    }

    let nextLesson = null;
    let nextLessonDisplay = null;
    let planned_lessons_in_cycle = null;
    if (enrollment && limit != null) {
      const cycle = enrollment.billing_cycle || 1;
      // Select next lesson by derived scheduled_ts (schedule wall time), not raw lesson_date timestamp hour.
      const { rows: nl } = await db.query(
        `WITH enr AS (
           SELECT id, lesson_times
           FROM enrollments
           WHERE id = $2
         ),
         l AS (
           SELECT
             lesson_date,
             to_char((lesson_date AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS ymd,
             EXTRACT(ISODOW FROM (lesson_date AT TIME ZONE 'Asia/Baku'))::int AS dow
           FROM lessons
           WHERE student_id = $1
             AND enrollment_id = $2
             AND billing_cycle = $3
             AND status = 'pending'
         ),
         sched AS (
           SELECT
             l.lesson_date,
             l.ymd,
             l.dow,
             (
               (l.ymd || ' ' ||
                 COALESCE(
                   NULLIF(LEFT((enr.lesson_times ->> l.dow::text), 5), ''),
                   to_char((l.lesson_date AT TIME ZONE 'Asia/Baku')::time, 'HH24:MI')
                 ) || ':00'
               )::timestamp AT TIME ZONE 'Asia/Baku'
             ) AS scheduled_ts,
             COALESCE(NULLIF(LEFT((enr.lesson_times ->> l.dow::text), 5), ''), NULL) AS wall_hm
           FROM l
           CROSS JOIN enr
         )
         SELECT lesson_date, ymd, scheduled_ts, wall_hm
         FROM sched
         WHERE scheduled_ts > NOW()
         ORDER BY scheduled_ts
         LIMIT 1`,
        [studentId, enrollment.id, cycle]
      );
      nextLesson = nl[0]?.scheduled_ts || null;
      if (nl[0]?.ymd) {
        const hm = nl[0]?.wall_hm != null ? String(nl[0].wall_hm).slice(0, 5) : null;
        nextLessonDisplay = hm ? `${nl[0].ymd} ${hm}:00` : `${nl[0].ymd}`;
      }

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

    // Last-lesson notification (package): only if enabled (cron will do the time-based trigger)
    if (enrollment && enrollment.notifications_enabled === true && limit != null && calendar_remaining_lessons === 1) {
      const instId = enrollment?.instructor_id || null;
      const studentBody =
        'Hörmətli tələbə, aylıq abunəliyinizin bitməsinə 2 gün qalıb. Davam etmək üçün ödənişi yeniləməyiniz xahiş olunur.';
      await ensureNotificationOnce({
        user_id: enrollment.student_id,
        type: 'billing_pkg_last_lesson_student',
        title: 'Paket bitir',
        body: studentBody,
      });
      if (instId) {
        const instBody =
          'Hörmətli tələbə, aylıq abunəliyinizin bitməsinə 2 gün qalıb. Davam etmək üçün ödənişi yeniləməyiniz xahiş olunur.';
        await ensureNotificationOnce({
          user_id: instId,
          type: 'billing_pkg_last_lesson_instructor',
          title: 'Paket bitir',
          body: instBody,
        });
      }
    }

    res.json({
      success: true,
      payments,
      enrollment: enrollmentOut
        ? {
            ...enrollmentOut,
            lesson_limit: limit,
            countdown_model: limit != null ? 'calendar' : null,
            calendar_used_lessons,
            calendar_total_lessons,
            remaining_lessons: calendar_remaining_lessons,
            next_lesson_at: nextLesson,
            next_lesson_display: nextLessonDisplay,
            planned_lessons_in_cycle: planned_lessons_in_cycle,
            lesson_start_date_for_display: lessonStartForDisplay,
            payment_start_date_for_display: lessonStartForDisplay,
            monthly_progress: monthlyProgress,
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
    if (legacy_kind === 'balance_adjustment' && en[0].billing_type !== 'monthly') {
      return res.status(400).json({ success: false, message: 'Balans düzəlişi yalnız aylıq paket üçün mümkündür' });
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
    } else if (legacy_kind === 'balance_adjustment') {
      notesOut = `[Balans düzəlişi]${notesOut ? ` ${notesOut}` : ''}`;
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
         AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1
         ${SQL_EXCLUDE_BALANCE_ADJUSTMENT}`,
      [iid]
    );

    const { rows } = await db.query(
      `SELECT e.id AS enrollment_id, u.id AS student_id, u.full_name, u.phone,
              e.billing_type AS enrollment_billing_type,
              COALESCE(e.payment_plan, 'full') AS payment_plan,
              sp.monthly_fee,
              to_char(e.enrollment_start_date::date, 'YYYY-MM-DD') AS lesson_start_date,
              ist.name AS track_subject_name,
              ig.name AS track_group_name
       FROM enrollments e
       INNER JOIN users u ON u.id = e.student_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       LEFT JOIN instructor_subjects ist ON ist.id = e.subject_id
       LEFT JOIN instructor_groups ig ON ig.id = e.group_id
       WHERE u.role = 'student' AND u.is_active = TRUE
         AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1
       ORDER BY u.full_name`,
      [iid]
    );

    const { byEnrollment: balMap, pendingSum, todayBaku } = await loadInstructorMonthlyBalanceRows(db, iid);
    const pendingAmount = roundMoney(pendingSum);

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
      let b = null;
      if (r.enrollment_billing_type === 'monthly' && hasFee) {
        b = balMap.get(String(r.enrollment_id)) || null;
        if (b) {
          paymentStatus = b.payment_status;
          if (b.pending_debt > 0.005) pendingCount += 1;
        }
      }
      return {
        enrollment_id: r.enrollment_id,
        student_id: r.student_id,
        first_name: firstName,
        last_name: lastName,
        phone: r.phone,
        billing_type: r.enrollment_billing_type,
        payment_plan: r.payment_plan || 'full',
        monthly_fee: r.monthly_fee,
        lesson_start_date: r.lesson_start_date,
        payment_start_date: r.lesson_start_date,
        track_subject_name: r.track_subject_name || null,
        track_group_name: r.track_group_name || null,
        payment_status: paymentStatus,
        total_payments: b?.total_payments ?? null,
        accrued_total: b?.accrued_total ?? null,
        net_balance: b?.net_balance ?? null,
        pending_debt: b?.pending_debt ?? null,
        subscription_months: b?.subscription_months ?? null,
      };
    });

    res.json({
      success: true,
      totalEarnings: Number(sumRows[0].total) || 0,
      pendingCount,
      pendingAmount,
      today_baku: todayBaku || null,
      students,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

function parseOptionalPaymentDateYmd(v) {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, mo, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return s;
}

/** Aylıq ödəniş qeydi (defolt: aylıq məbləğ, tarix Bakı bu gün) */
const markMonthlyPaid = async (req, res) => {
  try {
    const { enrollment_id, amount: amountRaw, payment_date: paymentDateRaw, notes: notesRaw } = req.body;
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

    const payYmd = parseOptionalPaymentDateYmd(paymentDateRaw);
    const notesBase =
      notesRaw != null && String(notesRaw).trim() !== '' ? String(notesRaw).trim() : 'Aylıq abunə ödənişi';

    const { rows: ins } = await db.query(
      `INSERT INTO payments (enrollment_id, student_id, amount, currency, payment_method, status, paid_at, payment_date, notes)
       VALUES ($1, $2, $3, 'AZN', 'cash', 'completed', NOW(),
               COALESCE($4::date, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date),
               $5)
       RETURNING *`,
      [enrollment_id, en[0].student_id, amount, payYmd, notesBase]
    );
    res.json({ success: true, payment: ins[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Bir pəncərədə çox aylıq ödəniş sətiri (tək tranzaksiya) */
const markMonthlyPaidBatch = async (req, res) => {
  try {
    const { enrollment_id, payments: payRows } = req.body;
    if (!enrollment_id) {
      return res.status(400).json({ success: false, message: 'enrollment_id tələb olunur' });
    }
    if (!Array.isArray(payRows) || payRows.length === 0) {
      return res.status(400).json({ success: false, message: 'Ən azı bir ödəniş sətiri göndərin' });
    }
    if (payRows.length > 40) {
      return res.status(400).json({ success: false, message: 'Bir dəfədə ən çox 40 sətir' });
    }

    const { rows: en } = await db.query(
      `SELECT e.id, e.student_id, e.instructor_id, e.billing_type
       FROM enrollments e
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

    const normalized = [];
    for (let i = 0; i < payRows.length; i++) {
      const r = payRows[i] || {};
      const amt = Number(r.amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        return res.status(400).json({ success: false, message: `${i + 1}-ci sətirdə məbləğ düzgün deyil` });
      }
      const ymd = parseOptionalPaymentDateYmd(r.payment_date);
      const note =
        r.notes != null && String(r.notes).trim() !== '' ? String(r.notes).trim() : 'Aylıq abunə ödənişi';
      normalized.push({ amount: amt, payment_date: ymd, notes: note });
    }

    const inserted = await db.transaction(async (client) => {
      const amounts = normalized.map((r) => r.amount);
      const dates = normalized.map((r) => r.payment_date);
      const notes = normalized.map((r) => r.notes);
      const { rows: ins } = await client.query(
        `INSERT INTO payments (enrollment_id, student_id, amount, currency, payment_method, status, paid_at, payment_date, notes)
         SELECT $1::uuid, $2::uuid, t.amt, 'AZN', 'cash', 'completed', NOW(),
                COALESCE(t.pd::date, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date), t.nt
         FROM unnest($3::numeric[], $4::date[], $5::text[]) AS t(amt, pd, nt)
         RETURNING id, amount, payment_date, notes`,
        [enrollment_id, en[0].student_id, amounts, dates, notes]
      );
      return ins;
    });

    res.json({ success: true, payments: inserted, count: inserted.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getEnrollmentPaymentHistory = async (req, res) => {
  try {
    const { enrollment_id } = req.params;
    const { rows: en } = await db.query(
      `SELECT e.instructor_id, e.student_id, e.billing_type, e.enrollment_start_date,
              e.billing_timing, COALESCE(e.payment_plan, 'full') AS payment_plan,
              sp.monthly_fee
       FROM enrollments e
       LEFT JOIN student_profiles sp ON sp.user_id = e.student_id
       WHERE e.id = $1`,
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

    let balance_summary = null;
    const mf = en[0].monthly_fee != null ? Number(en[0].monthly_fee) : NaN;
    if (en[0].billing_type === 'monthly' && Number.isFinite(mf) && mf > 0) {
      const todayBaku = await getTodayBakuYmd(db);
      const { rows: pr } = await db.query(
        `SELECT COALESCE(SUM(amount), 0)::numeric AS t
         FROM payments WHERE enrollment_id = $1 AND status = 'completed'`,
        [enrollment_id]
      );
      const paid = Number(pr[0]?.t) || 0;
      const anchorYmd = anchorToYmd(en[0].enrollment_start_date);
      const st = computeMonthlyBalanceState({
        monthly_fee: mf,
        anchor_ymd: anchorYmd,
        today_ymd: todayBaku,
        total_paid: paid,
      });
      balance_summary = {
        monthly_fee: mf,
        billing_timing: en[0].billing_timing || 'postpaid',
        payment_plan: en[0].payment_plan || 'full',
        anchor_ymd: anchorYmd,
        accrued_total: st.accrued_total,
        total_payments: st.total_payments,
        pending_debt: st.pending_debt,
        net_balance: st.net_balance,
        subscription_months: st.subscription_months,
        billing_anchor_future: Boolean(st.billing_anchor_future),
      };
    }

    res.json({ success: true, payments: rows, balance_summary: balance_summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

function looksLikeUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || '').trim());
}

/** Müəllim/admin: təkrarlanan və ya səhv ödəniş sətirini silir (cəmlər SUM ilə avtomatik düzəlir) */
const deletePayment = async (req, res) => {
  try {
    const paymentId = String(req.params.payment_id || '').trim();
    if (!looksLikeUuid(paymentId)) {
      return res.status(400).json({ success: false, message: 'Ödəniş ID düzgün deyil' });
    }

    const { rows } = await db.query(
      `SELECT p.id, p.enrollment_id, e.instructor_id
       FROM payments p
       INNER JOIN enrollments e ON e.id = p.enrollment_id
       WHERE p.id = $1`,
      [paymentId]
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Ödəniş tapılmadı' });
    }
    if (req.user.role === 'instructor' && !sameUuid(rows[0].instructor_id, req.user.id)) {
      return res.status(403).json({ success: false, message: 'Bu ödənişi silmək üçün icazəniz yoxdur' });
    }

    await db.query(`DELETE FROM payments WHERE id = $1`, [paymentId]);
    res.json({ success: true });
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
  markMonthlyPaidBatch,
  getEnrollmentPaymentHistory,
  deletePayment,
};
