/**
 * Paket əsaslı ödəniş tarixçəsi — tələbə və müəllim üçün eyni məntiq.
 */
const { getTodayBakuYmd } = require('./subscriptionBilling');
const { normalizePackBillingType, billingLimit, ensurePackLessonsUpTo } = require('./packLessons');

function toYmd(v) {
  if (v == null) return null;
  const s = String(v);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function toBakuYmd(v) {
  if (v == null) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Baku' });
}

function isMissingPaymentsStatusColumn(err) {
  const msg = err && err.message ? String(err.message) : '';
  return /column\s+"status"\s+does\s+not\s+exist/i.test(msg);
}

function isCompletedPaymentRow(p) {
  const st = String(p?.status || '').toLowerCase();
  if (st === 'completed') return true;
  if (!st && (p?.paid_at || p?.payment_date)) return true;
  return false;
}

function isStudentCountablePayment(p) {
  const notes = String(p?.notes || '');
  if (notes.startsWith('[Balans düzəlişi]')) return false;
  return isCompletedPaymentRow(p);
}

function compareYmd(a, b) {
  const sa = String(a || '').slice(0, 10);
  const sb = String(b || '').slice(0, 10);
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  return 0;
}

function comparePaymentsChronological(a, b) {
  const paymentSortYmd = (p) => {
    const ymd = p.payment_date != null ? String(p.payment_date).slice(0, 10) : '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
    return toBakuYmd(p?.paid_at) || toYmd(p?.paid_at) || '';
  };
  const da = paymentSortYmd(a);
  const db = paymentSortYmd(b);
  const ca = compareYmd(da, db);
  if (ca !== 0) return ca;
  return String(a?.id || '').localeCompare(String(b?.id || ''));
}

function allocatePaymentsToLessonPackages({
  lessonPackages,
  payments,
  systemCreatedYmd,
  preSystemEnrollment,
  enrollment,
  todayYmd,
}) {
  const { allocateMonthlyPaymentsToDues, resolveMonthlyAnchorYmd } = require('./subscriptionBilling');

  function usesAnchorMonthlyPaymentTimeline(en, pays) {
    const bt = String(en?.billing_type || '');
    if (bt === 'monthly') return true;
    if (!en?.enrollment_start_date) return false;
    if (bt !== '8_lessons' && bt !== '12_lessons') return false;
    return (pays || []).length > 0;
  }

  const pkgs = [...(lessonPackages || [])].sort(
    (a, b) => (Number(a.package_number) || 0) - (Number(b.package_number) || 0)
  );
  const buckets = new Map();
  for (const pkg of pkgs) {
    buckets.set(Number(pkg.package_number) || 1, { total_paid: 0, payments: [] });
  }

  const sorted = [...(payments || [])].filter(isStudentCountablePayment).sort(comparePaymentsChronological);
  const used = new Set();
  const sysYmd = systemCreatedYmd ? String(systemCreatedYmd).slice(0, 10) : null;

  const pkgHasPayment = (cyc) => (buckets.get(cyc)?.payments?.length || 0) > 0;

  const assign = (p, cyc) => {
    if (!buckets.has(cyc)) return false;
    const id = p?.id != null ? String(p.id) : '';
    if (id && used.has(id)) return false;
    if (pkgHasPayment(cyc)) return false;
    buckets.get(cyc).payments.push(p);
    buckets.get(cyc).total_paid += Number(p.amount) || 0;
    if (id) used.add(id);
    return true;
  };

  const isPkgCompleted = (pkg) => {
    const total = Number(pkg.total) || 0;
    const completed = Number(pkg.completed) || 0;
    return (
      String(pkg.package_status || '').toLowerCase() === 'completed' ||
      (total > 0 && completed >= total)
    );
  };

  const useMonthlyPack = usesAnchorMonthlyPaymentTimeline(enrollment, sorted);

  if (useMonthlyPack && enrollment?.enrollment_start_date) {
    const anchorYmd = resolveMonthlyAnchorYmd({
      enrollment_start_date: enrollment.enrollment_start_date,
      enrolled_at: enrollment.enrolled_at,
      payment_start_date: enrollment.payment_start_date,
      today_ymd: todayYmd,
    });
    const lastPkgEnd = pkgs.reduce((mx, p) => {
      const e = p.end_ymd ? String(p.end_ymd).slice(0, 10) : '';
      if (e && (!mx || compareYmd(e, mx) > 0)) return e;
      return mx;
    }, '');
    const untilYmd =
      lastPkgEnd && todayYmd && compareYmd(lastPkgEnd, todayYmd) > 0 ? lastPkgEnd : todayYmd || anchorYmd;

    const { paidByDue } = allocateMonthlyPaymentsToDues({
      anchorYmd,
      todayYmd: untilYmd || anchorYmd,
      payments: sorted,
    });

    const paidList = [...paidByDue.entries()]
      .sort((a, b) => compareYmd(a[0], b[0]))
      .map(([due, p]) => ({
        due,
        payment: { ...p, payment_date: p.payment_date || due },
      }));

    const completedPkgs = pkgs.filter(isPkgCompleted);

    for (const pkg of completedPkgs) {
      const cyc = Number(pkg.package_number) || 1;
      if (pkgHasPayment(cyc)) continue;
      const s = pkg.start_ymd ? String(pkg.start_ymd).slice(0, 10) : null;
      const e = pkg.end_ymd ? String(pkg.end_ymd).slice(0, 10) : null;
      const inWindow = paidList.find(({ due, payment }) => {
        const id = payment?.id != null ? String(payment.id) : '';
        if (id && used.has(id)) return false;
        if (!s || !e) return false;
        return compareYmd(due, s) >= 0 && compareYmd(due, e) <= 0;
      });
      if (inWindow) assign(inWindow.payment, cyc);
    }

    let pi = 0;
    for (const pkg of completedPkgs) {
      const cyc = Number(pkg.package_number) || 1;
      if (pkgHasPayment(cyc)) continue;
      while (pi < paidList.length) {
        const { payment } = paidList[pi++];
        const id = payment?.id != null ? String(payment.id) : '';
        if (id && used.has(id)) continue;
        assign(payment, cyc);
        break;
      }
    }
  } else if (!preSystemEnrollment) {
    for (const p of sorted) {
      const cyc = Number(p.billing_cycle);
      if (!Number.isFinite(cyc) || cyc < 1 || !buckets.has(cyc)) continue;
      assign(p, cyc);
    }
    for (const p of sorted) {
      if (used.has(String(p.id))) continue;
      const ymd =
        p.payment_date != null ? String(p.payment_date).slice(0, 10) : toBakuYmd(p.paid_at) || '';
      if (!ymd) continue;
      const match = pkgs.find((pkg) => {
        if (pkgHasPayment(Number(pkg.package_number) || 1)) return false;
        const s = pkg.start_ymd ? String(pkg.start_ymd).slice(0, 10) : null;
        const e = pkg.end_ymd ? String(pkg.end_ymd).slice(0, 10) : null;
        if (!s || !e) return false;
        return compareYmd(ymd, s) >= 0 && compareYmd(ymd, e) <= 0;
      });
      if (match) assign(p, Number(match.package_number) || 1);
    }
  } else {
    const unmatched = sorted.filter((p) => !used.has(String(p.id)));
    const needPkg = pkgs.filter((pkg) => isPkgCompleted(pkg) && !pkgHasPayment(Number(pkg.package_number) || 1));
    let ui = 0;
    for (const pkg of needPkg) {
      if (ui >= unmatched.length) break;
      assign(unmatched[ui++], Number(pkg.package_number) || 1);
    }
  }

  const enriched = (lessonPackages || []).map((pkg) => {
    const cyc = Number(pkg.package_number) || 1;
    const b = buckets.get(cyc) || { total_paid: 0, payments: [] };
    const paid = Number(b.total_paid) || 0;
    const legacyConfirmed = Boolean(
      paid <= 0.005 &&
        (String(pkg.package_status || '').toLowerCase() === 'completed' || isPkgCompleted(pkg)) &&
        pkg.end_ymd &&
        sysYmd &&
        compareYmd(String(pkg.end_ymd).slice(0, 10), sysYmd) < 0
    );
    const payment_status = paid > 0.005 ? 'paid' : legacyConfirmed ? 'confirmed_legacy' : 'unpaid';
    return {
      ...pkg,
      total_paid: paid,
      package_payments: b.payments,
      legacy_confirmed: legacyConfirmed,
      payment_status,
    };
  });

  return {
    lesson_packages: enriched,
    payments_by_cycle: enriched.map((p) => ({
      billing_cycle: Number(p.package_number) || 1,
      total_paid: Number(p.total_paid) || 0,
    })),
  };
}

function parseLessonWeekdaysJson(raw) {
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      arr = [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const d = parseInt(String(x), 10);
    if (Number.isFinite(d) && d >= 1 && d <= 7 && !seen.has(d)) {
      seen.add(d);
      out.push(d);
    }
  }
  return out.sort((a, b) => a - b);
}

function ymdAddDays(ymd, days) {
  const s = String(ymd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const next = new Date(dt.getTime() + Number(days || 0) * 86400000);
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(next.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function weekdayFromYmd(ymd) {
  const s = String(ymd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return ((dt.getUTCDay() + 6) % 7) + 1;
}

function buildVirtualLessonPackages({ start_ymd, today_ymd, lesson_weekdays, limit }) {
  const start = String(start_ymd || '').slice(0, 10);
  const today = today_ymd ? String(today_ymd).slice(0, 10) : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return [];
  const lim = Number(limit) || 0;
  if (!lim) return [];
  const wdays = parseLessonWeekdaysJson(lesson_weekdays);
  if (!wdays.length) return [];

  const dates = [];
  let cursor = start;
  for (let guard = 0; guard < 4000; guard += 1) {
    const dow = weekdayFromYmd(cursor);
    if (dow && wdays.includes(dow)) dates.push(cursor);
    if (cursor >= today) break;
    cursor = ymdAddDays(cursor, 1);
    if (!cursor) break;
  }
  if (!dates.length) return [];

  const doneCount = dates.filter((d) => d <= today).length;
  const currentPkg = Math.floor(doneCount / lim) + 1;
  const needTotal = currentPkg * lim;
  cursor = ymdAddDays(today, 1);
  for (let guard = 0; guard < 1200 && dates.length < needTotal; guard += 1) {
    const dow = weekdayFromYmd(cursor);
    if (dow && wdays.includes(dow)) dates.push(cursor);
    cursor = ymdAddDays(cursor, 1);
    if (!cursor) break;
  }

  const by = new Map();
  for (let idx = 0; idx < dates.length; idx += 1) {
    const cycle = Math.floor(idx / lim) + 1;
    const lessonNumber = (idx % lim) + 1;
    const ymd = dates[idx];
    if (!by.has(cycle)) {
      by.set(cycle, {
        package_number: cycle,
        start_ymd: ymd,
        end_ymd: ymd,
        total: lim,
        completed: 0,
        lessons: [],
      });
    }
    const pkg = by.get(cycle);
    if (ymd < pkg.start_ymd) pkg.start_ymd = ymd;
    if (ymd > pkg.end_ymd) pkg.end_ymd = ymd;
    const isPastOrToday = ymd <= today;
    const st = isPastOrToday ? 'done' : 'pending';
    if (isPastOrToday) pkg.completed += 1;
    pkg.lessons.push({ lesson_number: lessonNumber, ymd, status: st, scheduled_ts: null });
  }

  const outAsc = [...by.values()].sort((a, b) => a.package_number - b.package_number);
  const totalDone = outAsc.reduce((acc, p) => acc + (Number(p.completed) || 0), 0);
  const curPkgNo = Math.floor(totalDone / lim) + 1;
  for (const p of outAsc) {
    const isPastPkg = (Number(p.package_number) || 1) < curPkgNo && (Number(p.completed) || 0) >= lim;
    p.package_status = isPastPkg ? 'completed' : (Number(p.package_number) || 1) === curPkgNo ? 'active' : 'upcoming';
  }
  return outAsc.sort((a, b) => b.package_number - a.package_number);
}

async function loadPaymentsForEnrollment(dbConn, enrollmentId) {
  try {
    const { rows } = await dbConn.query(
      `SELECT p.id, p.amount, p.currency, p.payment_method, p.status, p.period, p.notes, p.paid_at, p.payment_date, p.billing_cycle
       FROM payments p
       WHERE p.enrollment_id = $1 AND (p.deleted_at IS NULL)
       ORDER BY p.payment_date ASC NULLS LAST, COALESCE(p.paid_at, p.payment_date::timestamptz) ASC NULLS LAST, p.id ASC`,
      [enrollmentId]
    );
    return rows;
  } catch (payErr) {
    if (!isMissingPaymentsStatusColumn(payErr)) throw payErr;
    const { rows } = await dbConn.query(
      `SELECT p.id, p.amount, p.currency, p.payment_method, NULL::text AS status, p.period, p.notes, p.paid_at, p.payment_date, p.billing_cycle
       FROM payments p
       WHERE p.enrollment_id = $1 AND (p.deleted_at IS NULL)
       ORDER BY p.payment_date ASC NULLS LAST, COALESCE(p.paid_at, p.payment_date::timestamptz) ASC NULLS LAST, p.id ASC`,
      [enrollmentId]
    );
    return rows;
  }
}

async function buildLessonPackagesFromDb(dbConn, enrollmentId, limit) {
  const { rows: lessonRows } = await dbConn.query(
    `WITH enr AS (SELECT id, lesson_times FROM enrollments WHERE id = $1),
     l AS (
       SELECT billing_cycle, lesson_number, status, lesson_date,
              to_char((lesson_date AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS ymd,
              EXTRACT(ISODOW FROM (lesson_date AT TIME ZONE 'Asia/Baku'))::int AS dow
       FROM lessons WHERE enrollment_id = $1 ORDER BY billing_cycle, lesson_number
     ),
     sched AS (
       SELECT l.billing_cycle, l.lesson_number, l.status, l.ymd,
         ((l.ymd || ' ' || COALESCE(NULLIF(LEFT((enr.lesson_times ->> l.dow::text), 5), ''),
           to_char((l.lesson_date AT TIME ZONE 'Asia/Baku')::time, 'HH24:MI')) || ':00')::timestamp AT TIME ZONE 'Asia/Baku') AS scheduled_ts
       FROM l CROSS JOIN enr
     )
     SELECT billing_cycle, lesson_number, status, ymd, scheduled_ts FROM sched ORDER BY billing_cycle, lesson_number`,
    [enrollmentId]
  );

  const by = new Map();
  const now = Date.now();
  for (const r of lessonRows) {
    const cyc = Number(r.billing_cycle) || 1;
    const ymd = r.ymd ? String(r.ymd).slice(0, 10) : null;
    const scheduledMs = r.scheduled_ts ? new Date(r.scheduled_ts).getTime() : null;
    const past = scheduledMs != null && Number.isFinite(scheduledMs) ? scheduledMs <= now : false;
    const st = r.status ? String(r.status) : 'pending';
    if (!by.has(cyc)) {
      by.set(cyc, {
        package_number: cyc,
        start_ymd: ymd,
        end_ymd: ymd,
        total: Number(limit) || null,
        completed: 0,
        lessons: [],
      });
    }
    const pkg = by.get(cyc);
    if (ymd) {
      if (!pkg.start_ymd || ymd < pkg.start_ymd) pkg.start_ymd = ymd;
      if (!pkg.end_ymd || ymd > pkg.end_ymd) pkg.end_ymd = ymd;
    }
    if (past && st === 'done') pkg.completed += 1;
    pkg.lessons.push({
      lesson_number: Number(r.lesson_number) || 0,
      ymd,
      status: st,
      scheduled_ts: r.scheduled_ts || null,
    });
  }
  return [...by.values()].sort((a, b) => b.package_number - a.package_number);
}

async function buildEnrollmentPackageHistoryView(dbConn, enrollmentId) {
  const { rows: enRows } = await dbConn.query(
    `SELECT e.*, u.full_name AS student_name, sp.monthly_fee AS student_monthly_fee,
            to_char(sp.payment_start_date::date, 'YYYY-MM-DD') AS payment_start_date
     FROM enrollments e
     LEFT JOIN users u ON u.id = e.student_id
     LEFT JOIN student_profiles sp ON sp.user_id = e.student_id
     WHERE e.id = $1`,
    [enrollmentId]
  );
  const enrollment = enRows[0];
  if (!enrollment) return null;

  const btNorm = normalizePackBillingType(enrollment.billing_type);
  const limit = billingLimit(btNorm);
  if (!limit) return { view_mode: 'unsupported' };

  try {
    await ensurePackLessonsUpTo(dbConn, { ...enrollment, billing_type: btNorm }, { horizonDays: 30 });
  } catch {
    // ignore
  }

  const startYmd = toYmd(enrollment.enrollment_start_date);
  const enrolledYmd = toBakuYmd(enrollment.enrolled_at) || toYmd(enrollment.enrolled_at);
  const preSystemEnrollment = Boolean(startYmd && enrolledYmd && startYmd < enrolledYmd);
  const todayBaku = await getTodayBakuYmd(dbConn);

  const payments = await loadPaymentsForEnrollment(dbConn, enrollmentId);

  let lesson_packages = await buildLessonPackagesFromDb(dbConn, enrollmentId, limit);
  if (preSystemEnrollment) {
    lesson_packages = buildVirtualLessonPackages({
      start_ymd: startYmd,
      today_ymd: todayBaku,
      lesson_weekdays: enrollment.lesson_weekdays,
      limit,
    });
  }

  const enrollmentForAlloc = {
    billing_type: btNorm,
    enrollment_start_date: enrollment.enrollment_start_date,
    enrolled_at: enrollment.enrolled_at,
    payment_start_date: enrollment.payment_start_date,
  };

  const allocated = allocatePaymentsToLessonPackages({
    lessonPackages: lesson_packages,
    payments,
    systemCreatedYmd: toYmd(enrollment.enrolled_at),
    preSystemEnrollment,
    enrollment: enrollmentForAlloc,
    todayYmd: todayBaku,
  });

  const totalPaid = payments.filter(isStudentCountablePayment).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const mf = enrollment.student_monthly_fee != null ? Number(enrollment.student_monthly_fee) : NaN;

  return {
    view_mode: 'packages',
    student_name: enrollment.student_name || null,
    lesson_packages: allocated.lesson_packages,
    payments_by_cycle: allocated.payments_by_cycle,
    summary: {
      billing_type: btNorm,
      monthly_fee: Number.isFinite(mf) ? mf : null,
      total_paid: totalPaid,
      pre_system_enrollment: preSystemEnrollment,
      lesson_start_date: startYmd,
      pack_count: allocated.lesson_packages.length,
      billing_timing: enrollment.billing_timing === 'prepaid' ? 'prepaid' : 'postpaid',
    },
  };
}

module.exports = {
  buildEnrollmentPackageHistoryView,
  allocatePaymentsToLessonPackages,
  isStudentCountablePayment,
};
