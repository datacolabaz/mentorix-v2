const db = require('../utils/db');
const {
  computeMonthlyBalanceState,
  computeMonthlyCycleProgress,
  getTodayBakuYmd,
  loadInstructorMonthlyBalanceRows,
  roundMoney,
  toYmd: anchorToYmd,
  toBakuYmd,
  resolveMonthlyAnchorYmd,
  allocateMonthlyPaymentsToDues,
  buildMonthlyPaymentHistoryTimeline,
  lastPaidDueYmd,
  listBillingDueDatesUpTo,
  compareYmd,
} = require('../services/subscriptionBilling');
const { ensurePackLessonsUpTo, normalizePackBillingType } = require('../services/packLessons');
const { buildEnrollmentPackageHistoryView } = require('../services/enrollmentPackagePayments');
const { sumInstructorExpectedPayments } = require('../services/instructorExpectedPayments');
const { SQL_INSTRUCTOR_REVENUE_FROM } = require('../services/instructorRevenue');
const { loadActiveEnrollmentForPayments } = require('../services/enrollmentGuards');
const { getGroupLessonSchedule } = require('../services/studentEnrollmentsService');
const { parseLessonWeekdaysJson } = require('./monthlyAttendanceController');

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

function addOneMonthYmd(anchorYmd, fromYmd) {
  const a = String(anchorYmd || '').slice(0, 10);
  const f = String(fromYmd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return null;
  const [, , ad] = a.split('-').map(Number);
  const [fy, fmo] = f.split('-').map(Number);
  let y = fy;
  let mo = fmo + 1;
  if (mo === 13) {
    y += 1;
    mo = 1;
  }
  const last = new Date(y, mo, 0).getDate();
  const d = Math.min(ad, last);
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function ymdToMs(ymd) {
  const s = String(ymd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return Date.UTC(y, m - 1, d, 12, 0, 0);
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

function parseLessonTimesJson(raw) {
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      obj = {};
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  return obj;
}

function padHHMM(t) {
  const m = String(t || '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mi = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  if (!Number.isFinite(h) || !Number.isFinite(mi)) return null;
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

function timeOnWeekday(lt, weekday) {
  if (!lt || typeof lt !== 'object') return null;
  const v = lt[String(weekday)] ?? lt[weekday];
  return padHHMM(v);
}

function ymdFromUtcNoonDate(dt) {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Pack expected lessons from startYmd up to todayYmd inclusive, based on weekly schedule.
 * IMPORTANT: calendar day iteration (no "weeks-based" shortcuts).
 */
function computeExpectedLessonsSinceStart({ start_ymd, today_ymd, lesson_weekdays, lesson_times }) {
  const start = String(start_ymd || '').slice(0, 10);
  const today = String(today_ymd || '').slice(0, 10);
  const startMs = ymdToMs(start);
  const todayMs = ymdToMs(today);
  if (startMs == null || todayMs == null) return 0;
  if (todayMs < startMs) return 0;
  const wdays = parseLessonWeekdaysJson(lesson_weekdays);
  const lt = parseLessonTimesJson(lesson_times);
  if (!wdays.length) return 0;
  const wset = new Set(wdays);
  let expected = 0;
  for (let t = startMs; t <= todayMs; t += 86400000) {
    const dt = new Date(t);
    const dow = ((dt.getUTCDay() + 6) % 7) + 1; // Mon=1..Sun=7
    if (!wset.has(dow)) continue;
    if (!timeOnWeekday(lt, dow)) continue;
    expected += 1;
  }
  return expected;
}

/**
 * Monthly "lessons in cycle" is derived from weekly pattern (lesson_weekdays + lesson_times),
 * independent of payments and calendar days.
 */
function computeMonthlyCycleLessons({ cycle_start_ymd, cycle_end_ymd, lesson_weekdays, lesson_times, today_ymd }) {
  const start = String(cycle_start_ymd || '').slice(0, 10);
  const end = String(cycle_end_ymd || '').slice(0, 10);
  const today = today_ymd ? String(today_ymd).slice(0, 10) : null;
  const startMs = ymdToMs(start);
  const endMs = ymdToMs(end);
  if (startMs == null || endMs == null) return { lessons_total: null, lessons_elapsed: null };
  if (endMs <= startMs) return { lessons_total: 0, lessons_elapsed: 0 };

  const wdays = parseLessonWeekdaysJson(lesson_weekdays);
  const lt = parseLessonTimesJson(lesson_times);
  if (!wdays.length) return { lessons_total: 0, lessons_elapsed: 0 };

  const wset = new Set(wdays);
  let total = 0;
  let elapsed = 0;
  for (let t = startMs; t < endMs; t += 86400000) {
    const dt = new Date(t);
    const dow = ((dt.getUTCDay() + 6) % 7) + 1; // Mon=1..Sun=7
    if (!wset.has(dow)) continue;
    if (!timeOnWeekday(lt, dow)) continue;
    total += 1;
    if (today && ymdFromUtcNoonDate(dt) <= today) elapsed += 1;
  }
  return { lessons_total: total, lessons_elapsed: elapsed };
}

/**
 * Monthly anchor should normally be enrollment_start_date (billing start date).
 * If it's accidentally set far in the future while the enrollment actually started earlier,
 * prefer enrolled_at to avoid bogus "0/xx" cycles and missing history.
 */
/** Yeni təsdiq axını: yalnız cari ay və sonrası (keçmiş qeydlərə toxunulmur). */
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
    out.push({
      due_ymd: due,
      amount: fee,
      period: `Aylıq: ${due}`,
    });
  }
  return out;
}

function supportsAnchorDueConfirmation(billingType) {
  const bt = String(billingType || '');
  return bt === 'monthly' || bt === '8_lessons' || bt === '12_lessons';
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
  let rows;
  try {
    ({ rows } = await db.query(
      `SELECT id, amount, status, payment_date, paid_at, notes, period
       FROM payments
       WHERE enrollment_id = $1
         AND (deleted_at IS NULL)`,
      [enrollmentId]
    ));
  } catch (e) {
    throw e;
  }
  const { paidByDue } = allocateMonthlyPaymentsToDues({
    anchorYmd,
    todayYmd: todayYmd || anchorYmd,
    payments: rows || [],
  });
  return new Set([...paidByDue.keys()]);
}

async function buildDueConfirmationsForInstructor(db, instructorId, todayBaku) {
  const cutoff = paymentConfirmationCutoffYmd(todayBaku);
  const { rows } = await db.query(
    `SELECT e.id AS enrollment_id, e.student_id, e.enrollment_start_date, e.enrolled_at,
            e.billing_type, u.full_name, u.phone, sp.monthly_fee,
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
    [normUuid(instructorId)]
  );

  const items = [];
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
    const parts = String(r.full_name || '').trim().split(/\s+/);
    for (const d of dues) {
      items.push({
        enrollment_id: r.enrollment_id,
        student_id: r.student_id,
        student_name: r.full_name,
        first_name: parts[0] || '—',
        last_name: parts.length > 1 ? parts.slice(1).join(' ') : '—',
        phone: r.phone,
        due_ymd: d.due_ymd,
        amount: d.amount,
        period: d.period,
        overdue: compareYmd(d.due_ymd, todayBaku) < 0,
      });
    }
  }
  items.sort((a, b) => {
    const c = compareYmd(a.due_ymd, b.due_ymd);
    if (c !== 0) return c;
    return String(a.student_name || '').localeCompare(String(b.student_name || ''), 'az');
  });
  return items;
}

async function buildPackDueConfirmationsForInstructor(db, instructorId, todayBaku) {
  const { rows } = await db.query(
    `SELECT e.id AS enrollment_id, u.full_name, sp.monthly_fee
     FROM enrollments e
     INNER JOIN users u ON u.id = e.student_id
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     WHERE e.billing_type IN ('8_lessons', '12_lessons')
       AND e.enrollment_start_date IS NOT NULL
       AND u.role = 'student'
       AND u.is_active = TRUE
       AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1
       AND (e.deleted_at IS NULL)`,
    [normUuid(instructorId)]
  );

  const items = [];
  for (const r of rows || []) {
    const fee = await inferFeeForEnrollment(db, r.enrollment_id, r.monthly_fee);
    if (!Number.isFinite(fee) || fee <= 0) continue;
    const view = await buildEnrollmentPackageHistoryView(db, r.enrollment_id);
    if (!view?.lesson_packages?.length) continue;
    const parts = String(r.full_name || '').trim().split(/\s+/);
    for (const pkg of view.lesson_packages) {
      const total = Number(pkg.total) || 0;
      const completed = Number(pkg.completed) || 0;
      if (total <= 0 || completed < total) continue;
      if (pkg.payment_status === 'paid' || pkg.legacy_confirmed) continue;
      if ((Number(pkg.total_paid) || 0) > 0.005) continue;
      const endYmd = pkg.end_ymd ? String(pkg.end_ymd).slice(0, 10) : todayBaku;
      const dueYmd = /^\d{4}-\d{2}-\d{2}$/.test(endYmd) ? endYmd : todayBaku;
      items.push({
        kind: 'pack',
        enrollment_id: r.enrollment_id,
        package_number: Number(pkg.package_number) || 1,
        student_name: r.full_name,
        first_name: parts[0] || '—',
        last_name: parts.length > 1 ? parts.slice(1).join(' ') : '—',
        amount: fee,
        due_ymd: dueYmd,
        period: `Paket #${Number(pkg.package_number) || 1}`,
        overdue: compareYmd(dueYmd, todayBaku) < 0,
      });
    }
  }
  items.sort((a, b) => {
    const c = compareYmd(a.due_ymd, b.due_ymd);
    if (c !== 0) return c;
    const pa = Number(a.package_number) || 0;
    const pb = Number(b.package_number) || 0;
    if (pa !== pb) return pa - pb;
    return String(a.student_name || '').localeCompare(String(b.student_name || ''), 'az');
  });
  return items;
}

const getRestorePreview = async (req, res) => {
  try {
    const { enrollment_id } = req.params;
    const { rows: en } = await db.query(
      `SELECT e.id, e.instructor_id, e.student_id, e.billing_type,
              e.enrolled_at, e.enrollment_start_date,
              e.lesson_weekdays, e.lesson_times,
              sp.monthly_fee,
              to_char(sp.payment_start_date::date, 'YYYY-MM-DD') AS payment_start_date
       FROM enrollments e
       LEFT JOIN student_profiles sp ON sp.user_id = e.student_id
       WHERE e.id = $1`,
      [enrollment_id]
    );
    if (!en[0]) return res.status(404).json({ success: false, message: 'Qeydiyyat tapılmadı' });
    if (req.user.role === 'instructor' && !sameUuid(en[0].instructor_id, req.user.id)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const bt = en[0].billing_type;
    const todayYmd = await getTodayBakuYmd(db);
    const enrolledYmd = toBakuYmd(en[0].enrolled_at) || toYmd(en[0].enrolled_at) || todayYmd;
    const anchorYmd =
      bt === 'monthly'
        ? resolveMonthlyAnchorYmd({
            enrollment_start_date: en[0].enrollment_start_date,
            enrolled_at: en[0].enrolled_at,
            payment_start_date: en[0].payment_start_date,
            today_ymd: todayYmd,
          })
        : anchorToYmd(en[0].enrollment_start_date);

    if (!anchorYmd) {
      return res.json({ success: true, items: [] });
    }

    let done = new Set();

    // Monthly restore
    if (bt === 'monthly') {
      const mf = en[0].monthly_fee != null ? Number(en[0].monthly_fee) : NaN;
      if (!Number.isFinite(mf) || mf <= 0) {
        return res.json({ success: true, items: [] });
      }
      let existingPayments;
      try {
        ({ rows: existingPayments } = await db.query(
          `SELECT id, amount, status, payment_date, paid_at, notes, period
           FROM payments
           WHERE enrollment_id = $1
             AND (deleted_at IS NULL)`,
          [enrollment_id]
        ));
      } catch (e) {
        throw e;
      }
      const { paidByDue } = allocateMonthlyPaymentsToDues({
        anchorYmd,
        todayYmd,
        payments: existingPayments || [],
      });
      done = new Set(paidByDue.keys());
      const preSystem = enrolledYmd && compareYmd(anchorYmd, enrolledYmd) < 0;

      const dueDates = listBillingDueDatesUpTo(anchorYmd, todayYmd);
      const raw = [];
      for (const start of dueDates) {
        if (compareYmd(start, todayYmd) > 0) continue;
        if (preSystem && compareYmd(start, enrolledYmd) >= 0) continue;
        const end = addOneMonthYmd(anchorYmd, start);
        if (!end) continue;
        raw.push({
          id: `monthly:${start}`,
          kind: 'monthly',
          title: `${start} — ${end}`,
          cycle_start_ymd: start,
          cycle_end_ymd: end,
          amount: mf,
          payment_date: start,
        });
      }
      const items = raw.filter((x) => !done.has(x.payment_date));
      return res.json({ success: true, items });
    }

    // Package (8/12) restore
    const limit = billingLimit(bt);
    if (!limit) return res.json({ success: true, items: [] });

    if (!done.size) {
      const { rows: existing } = await db.query(
        `SELECT payment_date::text AS ymd
         FROM payments
         WHERE enrollment_id = $1
           AND status = 'completed'
           AND payment_date IS NOT NULL
           AND (deleted_at IS NULL)`,
        [enrollment_id]
      );
      done = new Set((existing || []).map((r) => String(r.ymd).slice(0, 10)));
    }

    function parseWeekdays(raw) {
      let arr = raw;
      if (typeof raw === 'string') {
        try {
          arr = JSON.parse(raw);
        } catch {
          arr = [];
        }
      }
      if (!Array.isArray(arr)) return [];
      const out = [];
      const seen = new Set();
      for (const x of arr) {
        const d = parseInt(String(x), 10);
        if (Number.isFinite(d) && d >= 1 && d <= 7 && !seen.has(d)) {
          seen.add(d);
          out.push(d);
        }
      }
      return out.sort((a, b) => a - b);
    }

    function parseTimes(raw) {
      let obj = raw;
      if (typeof raw === 'string') {
        try {
          obj = JSON.parse(raw);
        } catch {
          obj = {};
        }
      }
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
      return obj;
    }

    function parseYmdUtcNoonLocal(ymd) {
      const s = String(ymd || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
      const [y, m, d] = s.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    }

    function ymdFromUtcDate(dt) {
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dt.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    // Enumerate scheduled lesson dates between [startYmd, untilYmd) using weekly pattern.
    function enumeratePatternYmds(startYmd, untilYmd, wdays, lt) {
      const startDt = parseYmdUtcNoonLocal(startYmd);
      const untilDt = parseYmdUtcNoonLocal(untilYmd);
      if (!startDt || !untilDt) return [];
      if (startDt.getTime() >= untilDt.getTime()) return [];
      if (!Array.isArray(wdays) || !wdays.length) return [];
      // We only need dates, times are already embedded in pattern but don't affect cycle boundaries.
      const set = new Set();
      for (let t = startDt.getTime(); t < untilDt.getTime(); t += 86400000) {
        const dt = new Date(t);
        const dow = ((dt.getUTCDay() + 6) % 7) + 1; // Mon=1..Sun=7
        if (!wdays.includes(dow)) continue;
        const wall = lt?.[String(dow)] ?? lt?.[dow];
        if (!wall) continue; // must have time for day
        set.add(ymdFromUtcDate(dt));
      }
      return [...set].sort((a, b) => a.localeCompare(b));
    }

    // derive default package price from instructor's previous completed package payments
    const { rows: priceRows } = await db.query(
      `SELECT AVG(p.amount)::numeric AS avg_amt
       FROM payments p
       JOIN enrollments e2 ON e2.id = p.enrollment_id
       WHERE p.status = 'completed'
         AND e2.instructor_id = $1
         AND e2.billing_type = $2
         AND p.amount > 0`,
      [en[0].instructor_id, bt]
    );
    const avgAmt = priceRows[0]?.avg_amt != null ? Number(priceRows[0].avg_amt) : NaN;
    if (!Number.isFinite(avgAmt) || avgAmt <= 0) {
      return res.status(400).json({
        success: false,
        code: 'PACKAGE_PRICE_UNKNOWN',
        message: 'Paket üçün avtomatik məbləğ tapılmadı (əvvəlki ödənişlərdən çıxarmaq mümkün olmadı).',
      });
    }

    const wdays = parseWeekdays(en[0].lesson_weekdays);
    const lt = parseTimes(en[0].lesson_times);
    const lessonYmds = enumeratePatternYmds(anchorYmd, enrolledYmd, wdays, lt);
    if (!lessonYmds.length) return res.json({ success: true, items: [] });

    const cycles = Math.ceil(lessonYmds.length / limit);
    const raw = [];
    for (let c = 0; c < cycles; c++) {
      const startIdx = c * limit;
      const endIdx = Math.min(lessonYmds.length - 1, startIdx + limit - 1);
      const start = lessonYmds[startIdx];
      const end = lessonYmds[endIdx];
      if (!start) continue;
      if (start >= enrolledYmd) break;
      raw.push({
        id: `pkg:${c + 1}:${start}`,
        kind: 'package',
        title: `Paket Dövr #${c + 1}: ${start} — ${end || start}`,
        cycle_start_ymd: start,
        cycle_end_ymd: end || start,
        amount: avgAmt,
        payment_date: start,
      });
    }

    const items = raw.filter((x) => !done.has(x.payment_date));
    return res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const confirmRestorePayments = async (req, res) => {
  try {
    const { enrollment_id } = req.params;
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((x) => String(x)) : [];
    if (!ids.length) return res.status(400).json({ success: false, message: 'Heç nə seçilməyib' });

    const { rows: en } = await db.query(
      `SELECT e.id, e.instructor_id, e.student_id, e.billing_type,
              e.enrolled_at, e.enrollment_start_date,
              e.lesson_weekdays, e.lesson_times,
              sp.monthly_fee,
              to_char(sp.payment_start_date::date, 'YYYY-MM-DD') AS payment_start_date
       FROM enrollments e
       LEFT JOIN student_profiles sp ON sp.user_id = e.student_id
       WHERE e.id = $1`,
      [enrollment_id]
    );
    if (!en[0]) return res.status(404).json({ success: false, message: 'Qeydiyyat tapılmadı' });
    if (req.user.role === 'instructor' && !sameUuid(en[0].instructor_id, req.user.id)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }
    const bt = en[0].billing_type;
    const todayYmd = await getTodayBakuYmd(db);
    const enrolledYmd = toBakuYmd(en[0].enrolled_at) || toYmd(en[0].enrolled_at) || todayYmd;
    const anchorYmd =
      bt === 'monthly'
        ? resolveMonthlyAnchorYmd({
            enrollment_start_date: en[0].enrollment_start_date,
            enrolled_at: en[0].enrolled_at,
            payment_start_date: en[0].payment_start_date,
            today_ymd: todayYmd,
          })
        : anchorToYmd(en[0].enrollment_start_date);
    if (!anchorYmd) {
      return res.status(400).json({ success: false, message: 'Bərpa ediləcək aralıq yoxdur' });
    }

    if (bt === 'monthly') {
      const mf = en[0].monthly_fee != null ? Number(en[0].monthly_fee) : NaN;
      if (!Number.isFinite(mf) || mf <= 0) {
        return res.status(400).json({ success: false, message: 'Aylıq məbləğ tapılmadı' });
      }
      const preSystem = enrolledYmd && compareYmd(anchorYmd, enrolledYmd) < 0;
      const allowed = new Set();
      for (const start of listBillingDueDatesUpTo(anchorYmd, todayYmd)) {
        if (compareYmd(start, todayYmd) > 0) continue;
        if (preSystem && compareYmd(start, enrolledYmd) >= 0) continue;
        allowed.add(`monthly:${start}`);
      }
      const selected = ids.filter((x) => allowed.has(x)).map((x) => x.split(':')[1]);
      if (!selected.length) {
        return res.status(400).json({ success: false, message: 'Seçilmiş dövrlər etibarlı deyil' });
      }
      const inserted = await db.transaction(async (client) => {
        const { rows: existing } = await client.query(
          `SELECT payment_date::text AS ymd
           FROM payments
           WHERE enrollment_id = $1
             AND status = 'completed'
             AND payment_date = ANY($2::date[])`,
          [enrollment_id, selected]
        );
        const done = new Set(existing.map((r) => String(r.ymd).slice(0, 10)));
        const toInsert = selected.filter((d) => !done.has(String(d).slice(0, 10)));
        if (!toInsert.length) return [];
        const amounts = toInsert.map(() => mf);
        const notes = toInsert.map((d) => `[Keçmiş ödəniş qeydi] Aylıq abunə ödənişi (${d})`);
        const periods = toInsert.map((d) => `Aylıq: ${d}`);
        const { rows: ins } = await client.query(
          `INSERT INTO payments (enrollment_id, student_id, amount, currency, payment_method, status, paid_at, payment_date, notes, period)
           SELECT $1::uuid, $2::uuid, t.amt, 'AZN', 'cash', 'completed', NOW(),
                  t.pd::date, t.nt, t.per
           FROM unnest($3::numeric[], $4::date[], $5::text[], $6::text[]) AS t(amt, pd, nt, per)
           RETURNING id, amount, payment_date, notes, period`,
          [enrollment_id, en[0].student_id, amounts, toInsert, notes, periods]
        );
        return ins;
      });
      return res.json({ success: true, inserted, count: inserted.length });
    }

    const limit = billingLimit(bt);
    if (!limit) {
      return res.status(400).json({ success: false, message: 'Bu paket növü dəstəklənmir' });
    }

    function parseWeekdays(raw) {
      let arr = raw;
      if (typeof raw === 'string') {
        try {
          arr = JSON.parse(raw);
        } catch {
          arr = [];
        }
      }
      if (!Array.isArray(arr)) return [];
      const out = [];
      const seen = new Set();
      for (const x of arr) {
        const d = parseInt(String(x), 10);
        if (Number.isFinite(d) && d >= 1 && d <= 7 && !seen.has(d)) {
          seen.add(d);
          out.push(d);
        }
      }
      return out.sort((a, b) => a - b);
    }

    function parseTimes(raw) {
      let obj = raw;
      if (typeof raw === 'string') {
        try {
          obj = JSON.parse(raw);
        } catch {
          obj = {};
        }
      }
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
      return obj;
    }

    function parseYmdUtcNoonLocal(ymd) {
      const s = String(ymd || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
      const [y, m, d] = s.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    }

    function ymdFromUtcDate(dt) {
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dt.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    function enumeratePatternYmds(startYmd, untilYmd, wdays, lt) {
      const startDt = parseYmdUtcNoonLocal(startYmd);
      const untilDt = parseYmdUtcNoonLocal(untilYmd);
      if (!startDt || !untilDt) return [];
      if (startDt.getTime() >= untilDt.getTime()) return [];
      if (!Array.isArray(wdays) || !wdays.length) return [];
      const set = new Set();
      for (let t = startDt.getTime(); t < untilDt.getTime(); t += 86400000) {
        const dt = new Date(t);
        const dow = ((dt.getUTCDay() + 6) % 7) + 1;
        if (!wdays.includes(dow)) continue;
        const wall = lt?.[String(dow)] ?? lt?.[dow];
        if (!wall) continue;
        set.add(ymdFromUtcDate(dt));
      }
      return [...set].sort((a, b) => a.localeCompare(b));
    }

    const { rows: priceRows } = await db.query(
      `SELECT AVG(p.amount)::numeric AS avg_amt
       FROM payments p
       JOIN enrollments e2 ON e2.id = p.enrollment_id
       WHERE p.status = 'completed'
         AND e2.instructor_id = $1
         AND e2.billing_type = $2
         AND p.amount > 0`,
      [en[0].instructor_id, bt]
    );
    const avgAmt = priceRows[0]?.avg_amt != null ? Number(priceRows[0].avg_amt) : NaN;
    if (!Number.isFinite(avgAmt) || avgAmt <= 0) {
      return res.status(400).json({
        success: false,
        code: 'PACKAGE_PRICE_UNKNOWN',
        message: 'Paket üçün avtomatik məbləğ tapılmadı (əvvəlki ödənişlərdən çıxarmaq mümkün olmadı).',
      });
    }

    const wdays = parseWeekdays(en[0].lesson_weekdays);
    const lt = parseTimes(en[0].lesson_times);
    const lessonYmds = enumeratePatternYmds(anchorYmd, enrolledYmd, wdays, lt);
    const cycles = Math.ceil(lessonYmds.length / limit);
    const allowed = new Set();
    for (let c = 0; c < cycles; c++) {
      const startIdx = c * limit;
      const start = lessonYmds[startIdx];
      if (!start) continue;
      if (start >= enrolledYmd) break;
      allowed.add(`pkg:${c + 1}:${start}`);
    }
    const selected = ids.filter((x) => allowed.has(x)).map((x) => x.split(':')[2]);
    if (!selected.length) {
      return res.status(400).json({ success: false, message: 'Seçilmiş dövrlər etibarlı deyil' });
    }

    const inserted = await db.transaction(async (client) => {
      const { rows: existing } = await client.query(
        `SELECT payment_date::text AS ymd
         FROM payments
         WHERE enrollment_id = $1
           AND status = 'completed'
           AND payment_date = ANY($2::date[])`,
        [enrollment_id, selected]
      );
      const done = new Set(existing.map((r) => String(r.ymd).slice(0, 10)));
      const toInsert = selected.filter((d) => !done.has(String(d).slice(0, 10)));
      if (!toInsert.length) return [];
      const amounts = toInsert.map(() => avgAmt);
      const notes = toInsert.map((d) => `[Keçmiş ödəniş qeydi] Paket ödənişi (${bt}) (${d})`);
      const periods = toInsert.map((d) => `Paket: ${bt} · ${d}`);
      const { rows: ins } = await client.query(
        `INSERT INTO payments (enrollment_id, student_id, amount, currency, payment_method, status, paid_at, payment_date, notes, period)
         SELECT $1::uuid, $2::uuid, t.amt, 'AZN', 'cash', 'completed', NOW(),
                t.pd::date, t.nt, t.per
         FROM unnest($3::numeric[], $4::date[], $5::text[], $6::text[]) AS t(amt, pd, nt, per)
         RETURNING id, amount, payment_date, notes, period`,
        [enrollment_id, en[0].student_id, amounts, toInsert, notes, periods]
      );
      return ins;
    });
    return res.json({ success: true, inserted, count: inserted.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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

function paymentSortYmd(p) {
  const ymd = p?.payment_date != null ? String(p.payment_date).slice(0, 10) : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  return toBakuYmd(p?.paid_at) || toYmd(p?.paid_at) || '';
}

function comparePaymentsChronological(a, b) {
  const da = paymentSortYmd(a);
  const db = paymentSortYmd(b);
  const ca = compareYmd(da, db);
  if (ca !== 0) return ca;
  const ta = a?.paid_at ? new Date(a.paid_at).getTime() : 0;
  const tb = b?.paid_at ? new Date(b.paid_at).getTime() : 0;
  if (ta !== tb) return ta - tb;
  return String(a?.id || '').localeCompare(String(b?.id || ''));
}

/**
 * Paket tarixçəsi — 8/12 dərs + aylıq ödənişlər (Nihad Isayev tipli): ankor üzrə 1 ödəniş / paket.
 */
function allocatePaymentsToLessonPackages({
  lessonPackages,
  payments,
  systemCreatedYmd,
  preSystemEnrollment,
  enrollment,
  todayYmd,
}) {
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

  const useMonthlyPack =
    !preSystemEnrollment && usesAnchorMonthlyPaymentTimeline(enrollment, sorted);

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
        payment: {
          ...p,
          payment_date: p.payment_date || due,
        },
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
  } else {
    if (!preSystemEnrollment) {
      for (const p of sorted) {
        const cyc = Number(p.billing_cycle);
        if (!Number.isFinite(cyc) || cyc < 1 || !buckets.has(cyc)) continue;
        assign(p, cyc);
      }

      for (const p of sorted) {
        if (used.has(String(p.id))) continue;
        const ymd = paymentSortYmd(p);
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
      for (const p of sorted) {
        const cyc = Number(p.billing_cycle);
        if (!Number.isFinite(cyc) || cyc < 1 || !buckets.has(cyc)) continue;
        assign(p, cyc);
      }
      for (const p of sorted) {
        if (used.has(String(p.id))) continue;
        const ymd = paymentSortYmd(p);
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
      const unmatched = sorted.filter((p) => !used.has(String(p.id)));
      const needPkg = pkgs.filter((pkg) => isPkgCompleted(pkg) && !pkgHasPayment(Number(pkg.package_number) || 1));
      let ui = 0;
      for (const pkg of needPkg) {
        if (ui >= unmatched.length) break;
        assign(unmatched[ui++], Number(pkg.package_number) || 1);
      }
    }
  }

  const orphans = sorted.filter((p) => !used.has(String(p.id)));

  const enriched = (lessonPackages || []).map((pkg) => {
    const cyc = Number(pkg.package_number) || 1;
    const b = buckets.get(cyc) || { total_paid: 0, payments: [] };
    const paid = Number(b.total_paid) || 0;
    const legacyConfirmed = Boolean(
      paid <= 0.005 &&
        (String(pkg.package_status || '').toLowerCase() === 'completed' ||
          (Number(pkg.total) > 0 && Number(pkg.completed) >= Number(pkg.total))) &&
        pkg.end_ymd &&
        sysYmd &&
        compareYmd(String(pkg.end_ymd).slice(0, 10), sysYmd) < 0
    );
    return {
      ...pkg,
      total_paid: paid,
      package_payments: b.payments,
      legacy_confirmed: legacyConfirmed,
      payment_status: paid > 0.005 ? 'paid' : legacyConfirmed ? 'confirmed_legacy' : 'unpaid',
    };
  });

  const payments_by_cycle = enriched.map((p) => ({
    billing_cycle: Number(p.package_number) || 1,
    total_paid: Number(p.total_paid) || 0,
  }));

  return { lesson_packages: enriched, orphans, payments_by_cycle };
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
  // Mon=1..Sun=7
  return ((dt.getUTCDay() + 6) % 7) + 1;
}

function buildVirtualLessonPackages({
  start_ymd,
  today_ymd,
  lesson_weekdays,
  limit,
}) {
  const start = String(start_ymd || '').slice(0, 10);
  const today = today_ymd ? String(today_ymd).slice(0, 10) : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return [];
  const lim = Number(limit) || 0;
  if (!lim) return [];
  const wdays = parseLessonWeekdaysJson(lesson_weekdays);
  if (!wdays.length) return [];

  // Enumerate lesson dates by scanning calendar from start to "end of current pack".
  // Step 1: generate all lesson dates up to today.
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

  // Step 2: extend into the future so the current package has all its upcoming lessons (for end_ymd range).
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
    pkg.lessons.push({
      lesson_number: lessonNumber,
      ymd,
      status: st,
      scheduled_ts: null,
    });
  }

  const outAsc = [...by.values()].sort((a, b) => a.package_number - b.package_number);
  const totalDone = outAsc.reduce((acc, p) => acc + (Number(p.completed) || 0), 0);
  const curPkgNo = Math.floor(totalDone / lim) + 1;
  for (const p of outAsc) {
    const isPastPkg = (Number(p.package_number) || 1) < curPkgNo && (Number(p.completed) || 0) >= lim;
    // legacy_confirmed/payment status are filled later using systemCreatedYmd + payments_by_cycle
    p.package_status = isPastPkg ? 'completed' : (Number(p.package_number) || 1) === curPkgNo ? 'active' : 'upcoming';
  }
  return outAsc.sort((a, b) => b.package_number - a.package_number);
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
         WHERE (p.deleted_at IS NULL)
         ORDER BY p.payment_date ASC NULLS LAST, COALESCE(p.paid_at, p.payment_date::timestamptz) ASC NULLS LAST, p.id ASC`,
        [studentId]
      );
      payments = rows;
    } catch (payErr) {
      if (isMissingPaymentsStatusColumn(payErr)) {
        const { rows } = await db.query(
          `SELECT p.id, p.amount, p.currency, p.payment_method, NULL::text AS status, p.period, p.notes, p.paid_at, p.payment_date,
                  p.billing_cycle,
                  e.billing_type, e.lesson_count AS enrollment_lesson_count, e.billing_cycle AS enrollment_billing_cycle,
                  iu.full_name AS instructor_name
           FROM payments p
           INNER JOIN enrollments e ON e.id = p.enrollment_id AND e.student_id = $1
           LEFT JOIN users iu ON iu.id = e.instructor_id
           WHERE (p.deleted_at IS NULL)
           ORDER BY p.payment_date ASC NULLS LAST, COALESCE(p.paid_at, p.payment_date::timestamptz) ASC NULLS LAST, p.id ASC`,
          [studentId]
        );
        payments = rows;
      } else {
        console.error('listMyPayments: payments query failed', payErr);
        payments = [];
      }
    }

    const { rows: enRows } = await db.query(
      `SELECT e.*,
              iu.full_name AS instructor_name,
              sp.monthly_fee AS student_monthly_fee,
              to_char(sp.payment_start_date::date, 'YYYY-MM-DD') AS payment_start_date,
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
                to_char(sp.payment_start_date::date, 'YYYY-MM-DD') AS payment_start_date,
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

    if (enrollment && !parseLessonWeekdaysJson(enrollment.lesson_weekdays).length && enrollment.group_id) {
      const sched = await getGroupLessonSchedule(enrollment.group_id);
      if (sched.lesson_weekdays.length) {
        enrollment.lesson_weekdays = sched.lesson_weekdays;
        enrollment.lesson_times = sched.lesson_times;
      }
    }

    // Ensure future lessons exist for calendar views, but do NOT auto-advance billing_cycle here.
    if (enrollment && ['8_lessons', '12_lessons', null, ''].includes(enrollment.billing_type)) {
      try {
        const btNorm = normalizePackBillingType(enrollment.billing_type);
        await ensurePackLessonsUpTo(db, { ...enrollment, billing_type: btNorm }, { horizonDays: 30 });
      } catch (e) {
        console.error('ensurePackLessonsUpTo failed', e);
      }
    }
    let enrollmentOut = null;
    let lessonStartForDisplay = null;
    let monthlyProgress = null;
    if (enrollment) {
      const { student_monthly_fee, ...rest } = enrollment;
      lessonStartForDisplay = rest.enrollment_start_date || null;
      // Safety: after removing monthly billing, some legacy rows may still have empty billing_type.
      // Normalize to 8_lessons so UI doesn't show "—".
      const btRaw = rest.billing_type != null ? String(rest.billing_type).trim() : '';
      const btNorm = billingLimit(btRaw) ? btRaw : '8_lessons';
      const mfNum = student_monthly_fee != null ? Number(student_monthly_fee) : NaN;
      const startYmd = anchorToYmd(rest.enrollment_start_date);
      const enrolledYmd = toBakuYmd(rest.enrolled_at) || anchorToYmd(rest.enrolled_at);
      const preSystemEnrollment =
        Boolean(startYmd && enrolledYmd && startYmd < enrolledYmd);
      enrollmentOut = {
        ...rest,
        billing_type: btNorm,
        monthly_fee: Number.isFinite(mfNum) ? mfNum : null,
        enrolled_at: rest.enrolled_at || null,
        pre_system_enrollment: preSystemEnrollment,
      };
      if (rest.billing_type === 'monthly' && Number.isFinite(mfNum) && mfNum > 0 && enrollmentOut.id) {
        const todayBaku = await getTodayBakuYmd(db);
        const anchorYmd = resolveMonthlyAnchorYmd({
          enrollment_start_date: lessonStartForDisplay,
          enrolled_at: enrollmentOut.enrolled_at,
          today_ymd: todayBaku,
        });
        let pr;
        try {
          ({ rows: pr } = await db.query(
            `SELECT COALESCE(SUM(amount), 0)::numeric AS t
             FROM payments
             WHERE enrollment_id = $1 AND status = 'completed' AND (deleted_at IS NULL)`,
            [enrollmentOut.id]
          ));
        } catch (e) {
          if (!isMissingPaymentsStatusColumn(e)) throw e;
          ({ rows: pr } = await db.query(
            `SELECT COALESCE(SUM(amount), 0)::numeric AS t
             FROM payments
             WHERE enrollment_id = $1
               AND (deleted_at IS NULL)
               AND (paid_at IS NOT NULL OR payment_date IS NOT NULL)`,
            [enrollmentOut.id]
          ));
        }
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
        if (monthlyProgress?.cycle_start_ymd && monthlyProgress?.cycle_end_ymd) {
          const lc = computeMonthlyCycleLessons({
            cycle_start_ymd: monthlyProgress.cycle_start_ymd,
            cycle_end_ymd: monthlyProgress.cycle_end_ymd,
            lesson_weekdays: enrollmentOut.lesson_weekdays,
            lesson_times: enrollmentOut.lesson_times,
            today_ymd: todayBaku,
          });
          monthlyProgress = { ...monthlyProgress, ...lc };
        }

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
    const limit = enrollmentOut ? billingLimit(enrollmentOut.billing_type) : null;
    let calendar_used_lessons = null;
    let calendar_total_lessons = null;
    let calendar_remaining_lessons = null;
    let pack_total_completed = null;
    let current_package_number = null;
    let lessons_in_current_package = null;
    let expected_lessons_total = null;
    let current_package_expected = null;
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
            status,
            lesson_date,
            to_char((lesson_date AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS ymd,
            EXTRACT(ISODOW FROM (lesson_date AT TIME ZONE 'Asia/Baku'))::int AS dow
          FROM lessons
          WHERE enrollment_id = $1 AND billing_cycle = $2
        ),
        sched AS (
          SELECT
            l.status,
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
           COUNT(*) FILTER (WHERE scheduled_ts <= NOW() AND status = 'done')::int AS used
         FROM sched`,
        [enrollment.id, cycle]
      );
      const total = agg[0]?.total ?? 0;
      const used = agg[0]?.used ?? 0;
      /**
       * For lesson packs, "total in cycle" should be the pack limit (8/12),
       * not "how many dated lessons rows exist right now".
       * Legacy/converted enrollments may have only a subset of lessons inserted,
       * but remaining lessons still must show (limit - used).
       */
      const totalRows = Number(total) || 0;
      const usedRows = Math.max(0, Number(used) || 0);
      calendar_total_lessons = Math.max(Number(limit) || 0, totalRows);
      calendar_used_lessons = Math.min(Number(limit) || calendar_total_lessons, usedRows);
      calendar_remaining_lessons = Math.max(0, (Number(limit) || calendar_total_lessons) - calendar_used_lessons);

      // Pack-level totals: count all attended lessons (status='done') up to "now" using wall-time logic.
      const { rows: allAgg } = await db.query(
        `WITH enr AS (
           SELECT id, lesson_times
           FROM enrollments
           WHERE id = $1
         ),
        l AS (
          SELECT
            status,
            lesson_date,
            to_char((lesson_date AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS ymd,
            EXTRACT(ISODOW FROM (lesson_date AT TIME ZONE 'Asia/Baku'))::int AS dow
          FROM lessons
          WHERE enrollment_id = $1
        ),
        sched AS (
          SELECT
            l.status,
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
         SELECT COUNT(*) FILTER (WHERE scheduled_ts <= NOW() AND status = 'done')::int AS done_total
         FROM sched`,
        [enrollment.id]
      );
      pack_total_completed = Number(allAgg[0]?.done_total ?? 0) || 0;
      const lim = Number(limit) || 0;
      if (lim > 0) {
        current_package_number = Math.floor(pack_total_completed / lim) + 1;
        lessons_in_current_package = pack_total_completed % lim;
      }

      // Expected lessons based on weekly schedule (calendar day iteration).
      try {
        const todayBaku = await getTodayBakuYmd(db);
        const startYmd = toYmd(enrollmentOut?.enrollment_start_date || enrollmentOut?.lesson_start_date_for_display) || null;
        if (startYmd && lim > 0) {
          expected_lessons_total = computeExpectedLessonsSinceStart({
            start_ymd: startYmd,
            today_ymd: todayBaku,
            lesson_weekdays: enrollmentOut?.lesson_weekdays,
            lesson_times: enrollmentOut?.lesson_times,
          });
          current_package_expected = Math.max(1, Math.ceil(Number(expected_lessons_total || 0) / lim));
        }
      } catch {
        // ignore expected calc failures
      }
    }

    let nextLesson = null;
    let nextLessonDisplay = null;
    let planned_lessons_in_cycle = null;
    let lesson_packages = [];
    let attendance_pct = null;
    let payments_by_cycle = [];
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

    // Lesson history (package -> lessons) for student UI
    if (enrollmentOut?.id && limit != null) {
      try {
        const { rows: lessonRows } = await db.query(
          `WITH enr AS (
             SELECT id, lesson_times
             FROM enrollments
             WHERE id = $1
           ),
           l AS (
             SELECT
               billing_cycle,
               lesson_number,
               status,
               lesson_date,
               to_char((lesson_date AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS ymd,
               EXTRACT(ISODOW FROM (lesson_date AT TIME ZONE 'Asia/Baku'))::int AS dow
             FROM lessons
             WHERE enrollment_id = $1
             ORDER BY billing_cycle, lesson_number
           ),
           sched AS (
             SELECT
               l.billing_cycle,
               l.lesson_number,
               l.status,
               l.lesson_date,
               l.ymd,
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
           SELECT billing_cycle, lesson_number, status, ymd, lesson_date, scheduled_ts
           FROM sched
           ORDER BY billing_cycle, lesson_number`,
          [enrollmentOut.id]
        );

        // group by billing_cycle
        const by = new Map();
        const now = Date.now();
        let attTotal = 0;
        let attDone = 0;
        for (const r of lessonRows) {
          const cyc = Number(r.billing_cycle) || 1;
          const ln = Number(r.lesson_number) || 0;
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

          // attendance pct considers only lessons that happened and are marked done/absent
          if (past && (st === 'done' || st === 'absent')) {
            attTotal += 1;
            if (st === 'done') attDone += 1;
          }

          pkg.lessons.push({
            lesson_number: ln,
            ymd,
            status: st,
            scheduled_ts: r.scheduled_ts || null,
          });
        }
        lesson_packages = [...by.values()].sort((a, b) => b.package_number - a.package_number);
        attendance_pct = attTotal > 0 ? Math.round((attDone / attTotal) * 100) : null;
      } catch (e) {
        console.error('lesson_packages failed', e);
        lesson_packages = [];
        attendance_pct = null;
      }
    }

    // Backdating / auto-history restore:
    // For pre-system enrollments, always synthesize the full package history from schedule (calendar loop),
    // so students can see their full journey even if lesson rows were created late/partially.
    if (enrollmentOut?.pre_system_enrollment && limit != null) {
      const todayBaku = await getTodayBakuYmd(db);
      const startYmd = toYmd(enrollmentOut.lesson_start_date_for_display || enrollmentOut.enrollment_start_date);
      lesson_packages = buildVirtualLessonPackages({
        start_ymd: startYmd,
        today_ymd: todayBaku,
        lesson_weekdays: enrollmentOut.lesson_weekdays,
        limit,
      });

      // When we synthesize history for pre-system enrollments, align the "real" pack counters
      // with calendar-loop completion so top cards match timeline.
      const virtualDoneTotal = lesson_packages.reduce((acc, p) => acc + (Number(p.completed) || 0), 0);
      pack_total_completed = virtualDoneTotal;
      const lim = Number(limit) || 0;
      if (lim > 0) {
        current_package_number = Math.floor(virtualDoneTotal / lim) + 1;
        lessons_in_current_package = virtualDoneTotal % lim;
      }
    }

    // Payments summary per package (billing_cycle)
    if (enrollmentOut?.id) {
      try {
        let payAgg;
        try {
          ({ rows: payAgg } = await db.query(
            `SELECT COALESCE(billing_cycle, 1)::int AS billing_cycle,
                    COALESCE(SUM(amount), 0)::numeric AS total_paid
             FROM payments
             WHERE enrollment_id = $1
               AND status = 'completed'
             GROUP BY COALESCE(billing_cycle, 1)
             ORDER BY billing_cycle DESC`,
            [enrollmentOut.id]
          ));
        } catch (e) {
          if (!isMissingPaymentsStatusColumn(e)) throw e;
          ({ rows: payAgg } = await db.query(
            `SELECT COALESCE(billing_cycle, 1)::int AS billing_cycle,
                    COALESCE(SUM(amount), 0)::numeric AS total_paid
             FROM payments
             WHERE enrollment_id = $1
               AND (paid_at IS NOT NULL OR payment_date IS NOT NULL)
             GROUP BY COALESCE(billing_cycle, 1)
             ORDER BY billing_cycle DESC`,
            [enrollmentOut.id]
          ));
        }
        const systemCreatedYmd = toYmd(enrollmentOut?.enrolled_at);
        if (Array.isArray(lesson_packages) && lesson_packages.length) {
          const todayBakuAlloc = await getTodayBakuYmd(db);
          const allocated = allocatePaymentsToLessonPackages({
            lessonPackages: lesson_packages,
            payments,
            systemCreatedYmd,
            preSystemEnrollment: Boolean(enrollmentOut?.pre_system_enrollment),
            enrollment: enrollmentOut,
            todayYmd: todayBakuAlloc,
          });
          lesson_packages = allocated.lesson_packages;
          payments_by_cycle = allocated.payments_by_cycle;
          enrollmentOut = {
            ...enrollmentOut,
            payment_history_orphans: allocated.orphans,
          };
        } else {
          payments_by_cycle = payAgg.map((r) => ({
            billing_cycle: Number(r.billing_cycle) || 1,
            total_paid: Number(r.total_paid) || 0,
          }));
        }
      } catch (e) {
        console.error('payments_by_cycle failed', e);
        payments_by_cycle = [];
      }
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
            // If there are no dated lessons created yet, fall back to counter-based pack logic
            // so converted enrollments don't show 0 remaining.
            countdown_model:
              limit != null && Number(calendar_total_lessons || 0) > 0 ? 'calendar' : null,
            calendar_used_lessons:
              limit != null && Number(calendar_total_lessons || 0) > 0 ? calendar_used_lessons : null,
            calendar_total_lessons:
              limit != null && Number(calendar_total_lessons || 0) > 0 ? calendar_total_lessons : null,
            remaining_lessons:
              limit != null
                ? Number(calendar_total_lessons || 0) > 0
                  ? calendar_remaining_lessons
                  : Math.max(0, Number(limit) - Number(enrollmentOut.lesson_count || 0))
                : null,
            total_lessons_completed: pack_total_completed,
            current_package_number: current_package_number,
            lessons_in_current_package: lessons_in_current_package,
            expected_lessons_total: expected_lessons_total,
            current_package_expected: current_package_expected,
            lesson_packages: lesson_packages,
            attendance_pct: attendance_pct,
            payments_by_cycle: payments_by_cycle,
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
      sql += ` AND (p.deleted_at IS NULL)`;
    } else {
      sql += ` WHERE (p.deleted_at IS NULL)`;
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
    let en;
    try {
      en = await loadActiveEnrollmentForPayments(db, enrollment_id, {
        instructorUserId: req.user.id,
        userRole: req.user.role,
      });
    } catch (e) {
      return res.status(e.statusCode || 500).json({ success: false, message: e.message });
    }
    en = [en];
    if (legacy_kind === 'balance_adjustment' && en[0].billing_type !== 'monthly') {
      return res.status(400).json({ success: false, message: 'Balans düzəlişi yalnız aylıq paket üçün mümkündür' });
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ success: false, message: 'Məbləğ müsbət rəqəm olmalıdır' });
    }
    const studentId = en[0]?.student_id || null;
    const courseId = en[0]?.course_id || null;
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
    let inserted;
    try {
      ({ rows: inserted } = await db.query(
        `INSERT INTO payments (enrollment_id, student_id, course_id, amount, payment_method, period, billing_cycle, notes, status, payment_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          enrollment_id,
          studentId,
          courseId,
          amt,
          paymentMethodForDb(payment_method),
          derivedPeriod,
          cycle,
          notesOut,
          status || 'completed',
          payDate,
        ]
      ));
    } catch (e) {
      if (!isMissingPaymentsStatusColumn(e)) throw e;
      ({ rows: inserted } = await db.query(
        `INSERT INTO payments (enrollment_id, student_id, course_id, amount, payment_method, period, billing_cycle, notes, payment_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          enrollment_id,
          studentId,
          courseId,
          amt,
          paymentMethodForDb(payment_method),
          derivedPeriod,
          cycle,
          notesOut,
          payDate,
        ]
      ));
    }

    // Manual approval: if package is complete, a completed payment confirmation opens the next package.
    const lim = billingLimit(bt);
    const lc = Number(en[0]?.lesson_count ?? 0) || 0;
    const st = status || 'completed';
    if ((bt === '8_lessons' || bt === '12_lessons') && lim && lc >= lim && String(st).toLowerCase() === 'completed') {
      await db.query(
        `UPDATE enrollments
         SET billing_cycle = billing_cycle + 1,
             lesson_count = 0
         WHERE id = $1`,
        [enrollment_id]
      );
    }

    res.json({ success: true, payment: inserted[0] });
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
       ${SQL_INSTRUCTOR_REVENUE_FROM}`,
      [iid]
    );

    const { rows } = await db.query(
      `SELECT e.id AS enrollment_id, u.id AS student_id, u.full_name, u.phone,
              e.billing_type AS enrollment_billing_type,
              COALESCE(e.payment_plan, 'full') AS payment_plan,
              sp.monthly_fee,
              to_char(e.enrollment_start_date::date, 'YYYY-MM-DD') AS lesson_start_date,
              e.enrolled_at,
              to_char(sp.payment_start_date::date, 'YYYY-MM-DD') AS payment_start_date,
              ist.name AS track_subject_name,
              ig.name AS track_group_name
       FROM enrollments e
       INNER JOIN users u ON u.id = e.student_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       LEFT JOIN instructor_subjects ist ON ist.id = e.subject_id
       LEFT JOIN instructor_groups ig ON ig.id = e.group_id
       WHERE u.role = 'student' AND u.is_active = TRUE
         AND e.deleted_at IS NULL
         AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1
       ORDER BY u.full_name`,
      [iid]
    );

    const { byEnrollment: balMap, todayBaku } = await loadInstructorMonthlyBalanceRows(db, iid);
    const pendingAmount = await sumInstructorExpectedPayments(db, req.user.id);

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
      let billingAnchorYmd = r.lesson_start_date;
      if (r.enrollment_billing_type === 'monthly' && hasFee) {
        b = balMap.get(String(r.enrollment_id)) || null;
        if (b) {
          paymentStatus = b.payment_status;
          billingAnchorYmd = b.anchor_ymd || billingAnchorYmd;
          if (b.pending_debt > 0.005) pendingCount += 1;
        } else {
          billingAnchorYmd =
            resolveMonthlyAnchorYmd({
              enrollment_start_date: r.lesson_start_date,
              enrolled_at: r.enrolled_at,
              payment_start_date: r.payment_start_date,
              today_ymd: todayBaku,
            }) || billingAnchorYmd;
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
        lesson_start_date:
          r.enrollment_billing_type === 'monthly' ? billingAnchorYmd : r.lesson_start_date,
        payment_start_date:
          r.enrollment_billing_type === 'monthly' ? billingAnchorYmd : r.lesson_start_date,
        billing_anchor_ymd: r.enrollment_billing_type === 'monthly' ? billingAnchorYmd : null,
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

    const due_confirmations = await buildDueConfirmationsForInstructor(db, req.user.id, todayBaku);
    const pack_confirmations = await buildPackDueConfirmationsForInstructor(db, req.user.id, todayBaku);

    res.json({
      success: true,
      totalEarnings: Number(sumRows[0].total) || 0,
      pendingCount,
      pendingAmount,
      today_baku: todayBaku || null,
      payment_confirmation_cutoff: paymentConfirmationCutoffYmd(todayBaku),
      due_confirmations,
      pack_confirmations,
      students,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Müəllim: ödəniş vaxtı çatıb — təsdiqdən sonra tarixçə + gəlir sayğacları */
const confirmDuePayment = async (req, res) => {
  try {
    const enrollment_id = String(req.body?.enrollment_id || '').trim();
    const due_ymd = parseOptionalPaymentDateYmd(req.body?.due_ymd);
    if (!enrollment_id || !looksLikeUuid(enrollment_id)) {
      return res.status(400).json({ success: false, message: 'Qeydiyyat seçilməyib' });
    }
    if (!due_ymd) {
      return res.status(400).json({ success: false, message: 'Ödəniş tarixi düzgün deyil' });
    }

    let enRow;
    try {
      enRow = await loadActiveEnrollmentForPayments(db, enrollment_id, {
        instructorUserId: req.user.id,
        userRole: req.user.role,
      });
    } catch (e) {
      return res.status(e.statusCode || 500).json({ success: false, message: e.message });
    }
    const en = [enRow];
    if (!supportsAnchorDueConfirmation(en[0].billing_type)) {
      return res.status(400).json({ success: false, message: 'Bu paket növü üçün təsdiq dəstəklənmir' });
    }
    if (!en[0].enrollment_start_date) {
      return res.status(400).json({ success: false, message: 'Dərslərə başlama tarixi təyin edilməyib' });
    }

    const todayBaku = await getTodayBakuYmd(db);
    const cutoff = paymentConfirmationCutoffYmd(todayBaku);
    if (compareYmd(due_ymd, cutoff) < 0) {
      return res.status(400).json({
        success: false,
        message: 'Keçmiş aylar üçün təsdiq tələb olunmur — mövcud tarixçə qeydləri saxlanılır',
      });
    }
    if (compareYmd(due_ymd, todayBaku) > 0) {
      return res.status(400).json({ success: false, message: 'Ödəniş tarixi hələ çatmayıb' });
    }

    const anchorYmd = resolveMonthlyAnchorYmd({
      enrollment_start_date: en[0].enrollment_start_date,
      enrolled_at: en[0].enrolled_at,
      payment_start_date: en[0].payment_start_date,
      today_ymd: todayBaku,
    });
    const allowedDue = new Set(
      listBillingDueDatesUpTo(anchorYmd, todayBaku).filter((d) => compareYmd(d, cutoff) >= 0)
    );
    if (!allowedDue.has(due_ymd)) {
      return res.status(400).json({ success: false, message: 'Bu tarix aylıq dövr üçün etibarlı deyil' });
    }

    const paidSet = await loadPaidDatesForEnrollment(db, enrollment_id, anchorYmd, todayBaku);
    if (paidSet.has(due_ymd)) {
      return res.status(409).json({ success: false, message: 'Bu tarix üçün ödəniş artıq qeydə alınıb' });
    }

    const fee = await inferFeeForEnrollment(db, enrollment_id, en[0].monthly_fee);
    const amtRaw = req.body?.amount != null ? Number(req.body.amount) : fee;
    if (!Number.isFinite(amtRaw) || amtRaw <= 0) {
      return res.status(400).json({ success: false, message: 'Məbləğ müsbət olmalıdır' });
    }
    const amt = roundMoney(amtRaw);
    const studentName = String(en[0].full_name || 'Tələbə').trim();
    const notesExtra = req.body?.notes != null && String(req.body.notes).trim() ? String(req.body.notes).trim() : '';
    const notesOut = `[Ödəniş təsdiqi]${notesExtra ? ` ${notesExtra}` : ''}`;
    const period = `Aylıq: ${due_ymd}`;

    let inserted;
    try {
      ({ rows: inserted } = await db.query(
        `INSERT INTO payments (enrollment_id, student_id, amount, currency, payment_method, status, paid_at, payment_date, notes, period)
         VALUES ($1,$2,$3,'AZN','cash','completed',NOW(),$4::date,$5,$6)
         RETURNING *`,
        [enrollment_id, en[0].student_id, amt, due_ymd, notesOut, period]
      ));
    } catch (e) {
      if (!isMissingPaymentsStatusColumn(e)) throw e;
      ({ rows: inserted } = await db.query(
        `INSERT INTO payments (enrollment_id, student_id, amount, currency, payment_method, paid_at, payment_date, notes, period)
         VALUES ($1,$2,$3,'AZN','cash',NOW(),$4::date,$5,$6)
         RETURNING *`,
        [enrollment_id, en[0].student_id, amt, due_ymd, notesOut, period]
      ));
    }

    const [dd, mm, yyyy] = due_ymd.split('-');
    const dueLabel = `${dd}.${mm}.${yyyy}`;
    const smsBody = `Mentorix: ${studentName} — ${dueLabel} tarixinə aylıq ödəniş təsdiqləndi (${amt} ₼).`;
    const phone = en[0].phone ? String(en[0].phone).trim() : null;
    try {
      await db.query(
        `INSERT INTO sms_logs (instructor_id, student_id, phone, type, message, status, package_type, sent_at)
         VALUES ($1,$2,$3,'payment',$4,'sent','monthly',NOW())`,
        [req.user.id, en[0].student_id, phone, smsBody]
      );
    } catch (smsErr) {
      try {
        await db.query(
          `INSERT INTO sms_logs (instructor_id, phone, message, status)
           VALUES ($1,$2,$3,'sent')`,
          [req.user.id, phone, smsBody]
        );
      } catch {
        // sms_logs optional — payment still counts
      }
    }

    await ensureNotificationOnce({
      user_id: req.user.id,
      type: 'payment_confirmed',
      title: 'Ödəniş təsdiqləndi',
      body: `${studentName}: ${dueLabel} — ${amt} ₼`,
    });

    res.json({ success: true, payment: inserted[0], due_ymd, amount: amt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Müəllim: 8/12 paket tamamlanıb — təsdiqdən sonra ödəniş qeydə alınır */
const confirmPackPayment = async (req, res) => {
  try {
    const enrollment_id = String(req.body?.enrollment_id || '').trim();
    const package_number = Number(req.body?.package_number);
    if (!enrollment_id || !looksLikeUuid(enrollment_id)) {
      return res.status(400).json({ success: false, message: 'Qeydiyyat seçilməyib' });
    }
    if (!Number.isFinite(package_number) || package_number < 1) {
      return res.status(400).json({ success: false, message: 'Paket nömrəsi düzgün deyil' });
    }

    let enRow;
    try {
      enRow = await loadActiveEnrollmentForPayments(db, enrollment_id, {
        instructorUserId: req.user.id,
        userRole: req.user.role,
      });
    } catch (e) {
      return res.status(e.statusCode || 500).json({ success: false, message: e.message });
    }
    const en = [enRow];
    const bt = String(en[0].billing_type || '');
    if (bt !== '8_lessons' && bt !== '12_lessons') {
      return res.status(400).json({ success: false, message: 'Bu əməliyyat yalnız dərs paketi üçün keçərlidir' });
    }

    const view = await buildEnrollmentPackageHistoryView(db, enrollment_id);
    const pkg = (view?.lesson_packages || []).find(
      (p) => (Number(p.package_number) || 1) === package_number
    );
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Paket tapılmadı' });
    }
    const total = Number(pkg.total) || 0;
    const completed = Number(pkg.completed) || 0;
    if (total <= 0 || completed < total) {
      return res.status(400).json({ success: false, message: 'Paket hələ tamamlanmayıb' });
    }
    if (pkg.payment_status === 'paid' || (Number(pkg.total_paid) || 0) > 0.005) {
      return res.status(409).json({ success: false, message: 'Bu paket üçün ödəniş artıq qeydə alınıb' });
    }

    const fee = await inferFeeForEnrollment(db, enrollment_id, en[0].monthly_fee);
    const amtRaw = req.body?.amount != null ? Number(req.body.amount) : fee;
    if (!Number.isFinite(amtRaw) || amtRaw <= 0) {
      return res.status(400).json({ success: false, message: 'Məbləğ müsbət olmalıdır' });
    }
    const amt = roundMoney(amtRaw);
    const payDate =
      parseOptionalPaymentDateYmd(req.body?.payment_date) ||
      (pkg.end_ymd ? String(pkg.end_ymd).slice(0, 10) : null) ||
      (await getTodayBakuYmd(db));
    const studentName = String(en[0].full_name || 'Tələbə').trim();
    const notesExtra = req.body?.notes != null && String(req.body.notes).trim() ? String(req.body.notes).trim() : '';
    const notesOut = `[Ödəniş təsdiqi] Paket #${package_number}${notesExtra ? ` ${notesExtra}` : ''}`;
    const period = `Paket #${package_number}`;

    let inserted;
    try {
      ({ rows: inserted } = await db.query(
        `INSERT INTO payments (enrollment_id, student_id, amount, currency, payment_method, status, paid_at, payment_date, notes, period, billing_cycle)
         VALUES ($1,$2,$3,'AZN','cash','completed',NOW(),$4::date,$5,$6,$7)
         RETURNING *`,
        [enrollment_id, en[0].student_id, amt, payDate, notesOut, period, package_number]
      ));
    } catch (e) {
      if (!isMissingPaymentsStatusColumn(e)) throw e;
      ({ rows: inserted } = await db.query(
        `INSERT INTO payments (enrollment_id, student_id, amount, currency, payment_method, paid_at, payment_date, notes, period, billing_cycle)
         VALUES ($1,$2,$3,'AZN','cash',NOW(),$4::date,$5,$6,$7)
         RETURNING *`,
        [enrollment_id, en[0].student_id, amt, payDate, notesOut, period, package_number]
      ));
    }

    const lim = billingLimit(bt);
    const lc = Number(en[0].lesson_count ?? 0) || 0;
    const curCycle = Number(en[0].billing_cycle ?? 1) || 1;
    if (lim && package_number === curCycle && lc >= lim) {
      await db.query(
        `UPDATE enrollments SET billing_cycle = billing_cycle + 1, lesson_count = 0 WHERE id = $1`,
        [enrollment_id]
      );
    }

    const [dd, mm, yyyy] = payDate.split('-');
    const dueLabel = `${dd}.${mm}.${yyyy}`;
    await ensureNotificationOnce({
      user_id: req.user.id,
      type: 'payment_confirmed',
      title: 'Paket ödənişi təsdiqləndi',
      body: `${studentName}: Paket #${package_number} — ${amt} ₼ (${dueLabel})`,
    });

    res.json({
      success: true,
      payment: inserted[0],
      package_number,
      amount: amt,
      payment_date: payDate,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Yalnız aylıq paket — 8/12 dərs üçün heç vaxt aylıq timeline istifadə olunmur */
function usesAnchorMonthlyPaymentTimeline(enrollment, payments) {
  const bt = String(enrollment?.billing_type || '').trim();
  if (bt === '8_lessons' || bt === '12_lessons') return false;
  if (bt === 'monthly') return true;
  if (!enrollment?.enrollment_start_date) return false;
  return (payments || []).length > 0;
}

function shouldUsePackagePaymentHistory(billingType, forcePackages) {
  if (forcePackages) return true;
  const bt = String(billingType || '').trim();
  if (bt === 'monthly') return false;
  if (bt === '8_lessons' || bt === '12_lessons') return true;
  if (!bt) return true;
  return false;
}

function inferMonthlyFeeForTimeline(profileFee, payments) {
  const mf = profileFee != null ? Number(profileFee) : NaN;
  if (Number.isFinite(mf) && mf > 0) return mf;
  const amounts = (payments || [])
    .map((p) => Number(p.amount))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!amounts.length) return NaN;
  return amounts[0];
}

function parseOptionalPaymentDateYmd(v) {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, mo, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return s;
}

const getEnrollmentPaymentHistory = async (req, res) => {
  try {
    const { enrollment_id } = req.params;
    const { rows: en } = await db.query(
      `SELECT e.instructor_id, e.student_id, e.billing_type, e.enrollment_start_date, e.enrolled_at,
              e.billing_timing, COALESCE(e.payment_plan, 'full') AS payment_plan,
              sp.monthly_fee,
              to_char(sp.payment_start_date::date, 'YYYY-MM-DD') AS payment_start_date
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

    const forcePackages = String(req.query?.view || '').trim().toLowerCase() === 'packages';
    if (shouldUsePackagePaymentHistory(en[0].billing_type, forcePackages)) {
      const packView = (await buildEnrollmentPackageHistoryView(db, enrollment_id)) || {};
      return res.json({
        success: true,
        view_mode: 'packages',
        student_name: packView.student_name || null,
        lesson_packages: packView.lesson_packages || [],
        payments_by_cycle: packView.payments_by_cycle || [],
        summary: packView.summary || {
          billing_type: normalizePackBillingType(en[0].billing_type),
          monthly_fee:
            en[0].monthly_fee != null && Number.isFinite(Number(en[0].monthly_fee))
              ? Number(en[0].monthly_fee)
              : null,
          total_paid: 0,
          pre_system_enrollment: false,
          lesson_start_date: anchorToYmd(en[0].enrollment_start_date),
          pack_count: 0,
          billing_timing: en[0].billing_timing === 'prepaid' ? 'prepaid' : 'postpaid',
        },
        payments: [],
        balance_summary: null,
      });
    }

    const studentId = en[0].student_id;
    const instructorId = en[0].instructor_id;

    let rowsPrimary;
    try {
      ({ rows: rowsPrimary } = await db.query(
        `SELECT id, amount, currency, payment_method, status, payment_date, paid_at, notes, period
         FROM payments
         WHERE enrollment_id = $1
           AND (deleted_at IS NULL)
         ORDER BY payment_date ASC NULLS LAST, COALESCE(paid_at, payment_date::timestamptz) ASC NULLS LAST, id ASC`,
        [enrollment_id]
      ));
    } catch (e) {
      if (!isMissingPaymentsStatusColumn(e)) throw e;
      ({ rows: rowsPrimary } = await db.query(
        `SELECT id, amount, currency, payment_method, NULL::text AS status, payment_date, paid_at, notes, period
         FROM payments
         WHERE enrollment_id = $1
           AND (deleted_at IS NULL)
         ORDER BY payment_date ASC NULLS LAST, COALESCE(paid_at, payment_date::timestamptz) ASC NULLS LAST, id ASC`,
        [enrollment_id]
      ));
    }

    let rowsRelated = [];
    const useAnchorTimeline = usesAnchorMonthlyPaymentTimeline(en[0], rowsPrimary);
    if (studentId && instructorId && !useAnchorTimeline) {
      try {
        ({ rows: rowsRelated } = await db.query(
          `SELECT p.id, p.amount, p.currency, p.payment_method, p.status, p.payment_date, p.paid_at, p.notes, p.period
           FROM payments p
           INNER JOIN enrollments e2 ON e2.id = p.enrollment_id
           WHERE p.enrollment_id <> $1::uuid
             AND e2.student_id = $2
             AND e2.instructor_id = $3
             AND (p.deleted_at IS NULL)
           ORDER BY p.payment_date ASC NULLS LAST, COALESCE(p.paid_at, p.payment_date::timestamptz) ASC NULLS LAST, p.id ASC`,
          [enrollment_id, studentId, instructorId]
        ));
      } catch (e) {
        if (!isMissingPaymentsStatusColumn(e)) throw e;
        ({ rows: rowsRelated } = await db.query(
          `SELECT p.id, p.amount, p.currency, p.payment_method, NULL::text AS status, p.payment_date, p.paid_at, p.notes, p.period
           FROM payments p
           INNER JOIN enrollments e2 ON e2.id = p.enrollment_id
           WHERE p.enrollment_id <> $1::uuid
             AND e2.student_id = $2
             AND e2.instructor_id = $3
             AND (p.deleted_at IS NULL)
           ORDER BY p.payment_date ASC NULLS LAST, COALESCE(p.paid_at, p.payment_date::timestamptz) ASC NULLS LAST, p.id ASC`,
          [enrollment_id, studentId, instructorId]
        ));
      }
    }

    const seenIds = new Set();
    let rows = [];
    const pushRow = (r, fromOther) => {
      const id = String(r.id || '');
      if (!id || seenIds.has(id)) return;
      seenIds.add(id);
      rows.push({ ...r, from_other_enrollment: fromOther });
    };
    for (const r of rowsPrimary || []) pushRow(r, false);
    for (const r of rowsRelated || []) pushRow(r, true);
    rows.sort(comparePaymentHistoryAsc);

    let balance_summary = null;
    const mf = inferMonthlyFeeForTimeline(en[0].monthly_fee, rows);
    if (useAnchorTimeline && Number.isFinite(mf) && mf > 0) {
      const todayBakuForAnchor = await getTodayBakuYmd(db);
      let pr;
      try {
        ({ rows: pr } = await db.query(
          `SELECT COALESCE(SUM(amount), 0)::numeric AS t
           FROM payments WHERE enrollment_id = $1 AND status = 'completed' AND (deleted_at IS NULL)`,
          [enrollment_id]
        ));
      } catch (e) {
        if (!isMissingPaymentsStatusColumn(e)) throw e;
        ({ rows: pr } = await db.query(
          `SELECT COALESCE(SUM(amount), 0)::numeric AS t
           FROM payments
           WHERE enrollment_id = $1
             AND (deleted_at IS NULL)
             AND (paid_at IS NOT NULL OR payment_date IS NOT NULL)`,
          [enrollment_id]
        ));
      }
      const paid = Number(pr[0]?.t) || 0;
      const anchorYmd = resolveMonthlyAnchorYmd({
        enrollment_start_date: en[0].enrollment_start_date,
        enrolled_at: en[0].enrolled_at,
        payment_start_date: en[0].payment_start_date,
        today_ymd: todayBakuForAnchor,
      });
      const { paidByDue } = allocateMonthlyPaymentsToDues({
        anchorYmd,
        todayYmd: todayBakuForAnchor,
        payments: rows,
      });
      const st = computeMonthlyBalanceState({
        monthly_fee: mf,
        anchor_ymd: anchorYmd,
        today_ymd: todayBakuForAnchor,
        total_paid: paid,
      });
      const dues = listBillingDueDatesUpTo(anchorYmd, todayBakuForAnchor);
      balance_summary = {
        monthly_fee: mf,
        billing_timing: en[0].billing_timing || 'postpaid',
        payment_plan: en[0].payment_plan || 'full',
        anchor_ymd: anchorYmd,
        billing_type: en[0].billing_type,
        schedule_last_due_ymd: dues.length ? dues[dues.length - 1] : null,
        last_paid_due_ymd: lastPaidDueYmd(paidByDue),
        payment_count_allocated: paidByDue.size,
        db_payment_rows: rows.length,
        accrued_total: st.accrued_total,
        total_payments: st.total_payments,
        pending_debt: st.pending_debt,
        net_balance: st.net_balance,
        subscription_months: st.subscription_months,
        billing_anchor_future: Boolean(st.billing_anchor_future),
        payment_confirmation_cutoff: paymentConfirmationCutoffYmd(todayBakuForAnchor),
      };
      rows = buildMonthlyPaymentHistoryTimeline({
        anchorYmd,
        todayYmd: todayBakuForAnchor,
        monthlyFee: mf,
        payments: rows,
      });
    }

    res.json({ success: true, payments: rows, balance_summary: balance_summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

function looksLikeUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || '').trim());
}

/** Tarixçə UI: əsasən ödəniş tarixi (ankor), sonra qəbul vaxtı — köhnədən yeniyə */
function paymentHistorySortMs(r) {
  const pd = r.payment_date != null ? String(r.payment_date).slice(0, 10) : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(pd)) {
    return new Date(`${pd}T12:00:00Z`).getTime();
  }
  if (r.paid_at) {
    const t = new Date(r.paid_at).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

function comparePaymentHistoryAsc(a, b) {
  const da = paymentHistorySortMs(a);
  const db = paymentHistorySortMs(b);
  if (da !== db) return da - db;
  const ta = a.paid_at ? new Date(a.paid_at).getTime() : 0;
  const tb = b.paid_at ? new Date(b.paid_at).getTime() : 0;
  if (ta !== tb) return ta - tb;
  return String(a.id || '').localeCompare(String(b.id || ''));
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

/** Müəllim: sistemdən əvvəl tamamlanmış paketlər — bütün keçmiş ödənişləri bir dəfədə qeydə al */
const confirmAllLegacyPackPayments = async (req, res) => {
  try {
    const enrollment_id = String(req.params?.enrollment_id || '').trim();
    if (!enrollment_id || !looksLikeUuid(enrollment_id)) {
      return res.status(400).json({ success: false, message: 'Qeydiyyat seçilməyib' });
    }

    let enRow;
    try {
      enRow = await loadActiveEnrollmentForPayments(db, enrollment_id, {
        instructorUserId: req.user.id,
        userRole: req.user.role,
      });
    } catch (e) {
      return res.status(e.statusCode || 500).json({ success: false, message: e.message });
    }
    const bt = String(enRow.billing_type || '');
    if (bt !== '8_lessons' && bt !== '12_lessons') {
      return res.status(400).json({ success: false, message: 'Yalnız dərs paketi üçün keçərlidir' });
    }

    const view = await buildEnrollmentPackageHistoryView(db, enrollment_id);
    const fee = await inferFeeForEnrollment(db, enrollment_id, enRow.monthly_fee);
    if (!Number.isFinite(fee) || fee <= 0) {
      return res.status(400).json({ success: false, message: 'Paket məbləği təyin olunmayıb' });
    }

    const legacyPkgs = (view?.lesson_packages || []).filter((pkg) => {
      const total = Number(pkg.total) || 0;
      const completed = Number(pkg.completed) || 0;
      if (total <= 0 || completed < total) return false;
      if ((Number(pkg.total_paid) || 0) > 0.005) return false;
      if (pkg.payment_status === 'paid') return false;
      return Boolean(pkg.legacy_confirmed);
    });

    if (!legacyPkgs.length) {
      return res.json({
        success: true,
        count: 0,
        total_amount: 0,
        message: 'Qeydə alınacaq keçmiş paket yoxdur',
      });
    }

    const inserted = [];
    for (const pkg of legacyPkgs) {
      const package_number = Number(pkg.package_number) || 1;
      const amt = roundMoney(fee);
      const payDate =
        pkg.end_ymd && /^\d{4}-\d{2}-\d{2}$/.test(String(pkg.end_ymd).slice(0, 10))
          ? String(pkg.end_ymd).slice(0, 10)
          : await getTodayBakuYmd(db);
      const notesOut = `[Keçmiş paket qeydi] Paket #${package_number}`;
      const period = `Paket #${package_number}`;

      let rows;
      try {
        ({ rows } = await db.query(
          `INSERT INTO payments (enrollment_id, student_id, amount, currency, payment_method, status, paid_at, payment_date, notes, period, billing_cycle)
           VALUES ($1,$2,$3,'AZN','cash','completed',NOW(),$4::date,$5,$6,$7)
           RETURNING id, amount, payment_date, billing_cycle`,
          [enrollment_id, enRow.student_id, amt, payDate, notesOut, period, package_number]
        ));
      } catch (e) {
        if (!isMissingPaymentsStatusColumn(e)) throw e;
        ({ rows } = await db.query(
          `INSERT INTO payments (enrollment_id, student_id, amount, currency, payment_method, paid_at, payment_date, notes, period, billing_cycle)
           VALUES ($1,$2,$3,'AZN','cash',NOW(),$4::date,$5,$6,$7)
           RETURNING id, amount, payment_date, billing_cycle`,
          [enrollment_id, enRow.student_id, amt, payDate, notesOut, period, package_number]
        ));
      }
      if (rows[0]) inserted.push(rows[0]);
    }

    const total_amount = roundMoney(inserted.reduce((s, r) => s + (Number(r.amount) || 0), 0));
    const studentName = String(enRow.full_name || 'Tələbə').trim();
    await ensureNotificationOnce({
      user_id: enRow.student_id,
      type: 'payment',
      title: 'Ödəniş qeydləri yeniləndi',
      body: `${studentName}: ${inserted.length} keçmiş paket ödənişi sistemə əlavə olundu (${total_amount} ₼)`,
    });

    res.json({
      success: true,
      count: inserted.length,
      total_amount,
      payments: inserted,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  listPayments,
  addPayment,
  listMyPayments,
  getInstructorPaymentBoard,
  getEnrollmentPaymentHistory,
  getRestorePreview,
  confirmRestorePayments,
  confirmDuePayment,
  confirmPackPayment,
  confirmAllLegacyPackPayments,
  deletePayment,
};
