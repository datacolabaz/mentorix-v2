/**
 * Müəllim paneli: gözlənilən ödənişlər (aylıq + paket).
 * Dashboard əvvəl yalnız billing_type=monthly borcunu sayırdı; 8/12 dərs paketləri 0 göstərirdi.
 */
const {
  getTodayBakuYmd,
  resolveMonthlyAnchorYmd,
  listBillingDueDatesUpTo,
  allocateMonthlyPaymentsToDues,
  compareYmd,
  roundMoney,
} = require('./subscriptionBilling');
const { buildEnrollmentPackageHistoryView } = require('./enrollmentPackagePayments');

function normUuid(id) {
  return String(id).trim().toLowerCase().replace(/-/g, '');
}

function paymentConfirmationCutoffYmd(todayBaku) {
  const t = String(todayBaku || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return `${t.slice(0, 7)}-01`;
}

function listUnconfirmedMonthlyDues({ anchorYmd, todayYmd, monthlyFee, paidDateSet, confirmationCutoffYmd }) {
  const fee = Number(monthlyFee);
  if (!anchorYmd || !todayYmd || !Number.isFinite(fee) || fee <= 0) return [];
  const cutoff = confirmationCutoffYmd || paymentConfirmationCutoffYmd(todayYmd);
  const dueDates = listBillingDueDatesUpTo(anchorYmd, todayYmd);
  const out = [];
  for (const due of dueDates) {
    if (compareYmd(due, cutoff) < 0) continue;
    if (paidDateSet.has(due)) continue;
    if (compareYmd(due, todayYmd) > 0) continue;
    out.push({ due_ymd: due, amount: fee });
  }
  return out;
}

async function inferFeeForEnrollment(db, enrollmentId, profileFee) {
  const mf = profileFee != null ? Number(profileFee) : NaN;
  if (Number.isFinite(mf) && mf > 0) return mf;
  const { rows } = await db.query(
    `SELECT amount FROM payments
     WHERE enrollment_id = $1 AND (deleted_at IS NULL)
     ORDER BY payment_date DESC NULLS LAST, paid_at DESC NULLS LAST
     LIMIT 5`,
    [enrollmentId]
  );
  for (const r of rows || []) {
    const a = Number(r.amount);
    if (Number.isFinite(a) && a > 0) return roundMoney(a);
  }
  return NaN;
}

async function loadPaidDatesForEnrollment(db, enrollmentId, anchorYmd, todayYmd) {
  if (!anchorYmd) return new Set();
  const { rows } = await db.query(
    `SELECT id, amount, status, payment_date, paid_at, notes, period
     FROM payments
     WHERE enrollment_id = $1 AND (deleted_at IS NULL)`,
    [enrollmentId]
  );
  const { paidByDue } = allocateMonthlyPaymentsToDues({
    anchorYmd,
    todayYmd: todayYmd || anchorYmd,
    payments: rows || [],
  });
  return new Set([...paidByDue.keys()]);
}

async function sumMonthlyExpectedThisMonth(db, instructorNormId, todayBaku) {
  const cutoff = paymentConfirmationCutoffYmd(todayBaku);
  const { rows } = await db.query(
    `SELECT e.id AS enrollment_id, e.enrollment_start_date, e.enrolled_at,
            sp.monthly_fee,
            to_char(sp.payment_start_date::date, 'YYYY-MM-DD') AS payment_start_date
     FROM enrollments e
     INNER JOIN users u ON u.id = e.student_id
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     WHERE e.billing_type = 'monthly'
       AND e.enrollment_start_date IS NOT NULL
       AND u.role = 'student'
       AND u.is_active = TRUE
       AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1
       AND (e.deleted_at IS NULL)`,
    [instructorNormId]
  );

  let sum = 0;
  for (const r of rows || []) {
    const fee = await inferFeeForEnrollment(db, r.enrollment_id, r.monthly_fee);
    if (!Number.isFinite(fee) || fee <= 0) continue;
    const anchorYmd = resolveMonthlyAnchorYmd({
      enrollment_start_date: r.enrollment_start_date,
      enrolled_at: r.enrolled_at,
      payment_start_date: r.payment_start_date,
      today_ymd: todayBaku,
    });
    if (!anchorYmd) continue;
    const paidSet = await loadPaidDatesForEnrollment(db, r.enrollment_id, anchorYmd, todayBaku);
    const dues = listUnconfirmedMonthlyDues({
      anchorYmd,
      todayYmd: todayBaku,
      monthlyFee: fee,
      paidDateSet: paidSet,
      confirmationCutoffYmd: cutoff,
    });
    for (const d of dues) sum += Number(d.amount) || 0;
  }
  return sum;
}

async function sumPackExpectedOutstanding(db, instructorNormId, todayBaku) {
  const { rows } = await db.query(
    `SELECT e.id AS enrollment_id, sp.monthly_fee
     FROM enrollments e
     INNER JOIN users u ON u.id = e.student_id
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     WHERE e.billing_type IN ('8_lessons', '12_lessons')
       AND e.enrollment_start_date IS NOT NULL
       AND u.role = 'student'
       AND u.is_active = TRUE
       AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1
       AND (e.deleted_at IS NULL)`,
    [instructorNormId]
  );

  let sum = 0;
  for (const r of rows || []) {
    const fee = await inferFeeForEnrollment(db, r.enrollment_id, r.monthly_fee);
    if (!Number.isFinite(fee) || fee <= 0) continue;
    const view = await buildEnrollmentPackageHistoryView(db, r.enrollment_id);
    if (!view?.lesson_packages?.length) continue;
    for (const pkg of view.lesson_packages) {
      const total = Number(pkg.total) || 0;
      const completed = Number(pkg.completed) || 0;
      if (total <= 0 || completed < total) continue;
      if (pkg.payment_status === 'paid' || pkg.legacy_confirmed) continue;
      if ((Number(pkg.total_paid) || 0) > 0.005) continue;
      sum += fee;
    }
  }
  return sum;
}

/**
 * Dashboard KPI: cari ay üçün təsdiq gözləyən aylıq ödənişlər + ödənilməmiş tamamlanmış paketlər.
 */
async function sumInstructorExpectedPayments(db, instructorId) {
  const iid = normUuid(instructorId);
  const todayBaku = await getTodayBakuYmd(db);
  const monthly = await sumMonthlyExpectedThisMonth(db, iid, todayBaku);
  const pack = await sumPackExpectedOutstanding(db, iid, todayBaku);
  return roundMoney(monthly + pack);
}

module.exports = {
  sumInstructorExpectedPayments,
  paymentConfirmationCutoffYmd,
  listUnconfirmedMonthlyDues,
};
