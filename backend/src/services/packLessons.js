const db = require('../utils/db');

function billingLimit(billingType) {
  if (billingType === '8_lessons') return 8;
  if (billingType === '12_lessons') return 12;
  return null;
}

function normalizePackBillingType(raw) {
  const s = raw != null ? String(raw).trim() : '';
  if (s === '8_lessons' || s === '12_lessons') return s;
  return '8_lessons';
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
  const set = new Set();
  for (const x of arr) {
    const d = parseInt(String(x), 10);
    if (Number.isFinite(d) && d >= 1 && d <= 7) set.add(d);
  }
  return [...set].sort((a, b) => a - b);
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
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === '') continue;
    const s = String(v).trim().slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(s)) continue;
    out[String(k)] = s;
  }
  return out;
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

function nextDateForWeekday(afterYmd, weekday /*1-7*/, ymdInclusive) {
  const [y, mo, d] = String(afterYmd).slice(0, 10).split('-').map(Number);
  const base = new Date(Date.UTC(y, mo - 1, d));
  const baseDow = ((base.getUTCDay() + 6) % 7) + 1;
  let delta = (weekday - baseDow + 7) % 7;
  if (delta === 0 && !ymdInclusive) delta = 7;
  const dt = new Date(base.getTime() + delta * 86400000);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Generate dated lessons between [startYmd..endYmd] (inclusive), in Baku wall time.
 * Returns array of "YYYY-MM-DD HH:MM:SS" strings.
 */
function enumerateLessonStarts({ startYmd, endYmdInclusive, lessonWeekdays, lessonTimes }) {
  const start = String(startYmd || '').slice(0, 10);
  const end = String(endYmdInclusive || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return [];
  const wdays = Array.isArray(lessonWeekdays) ? lessonWeekdays : [];
  if (!wdays.length) return [];
  const times = lessonTimes && typeof lessonTimes === 'object' ? lessonTimes : {};

  let cursor = start;
  const out = [];
  // hard cap for safety (about 5 years of twice-weekly lessons)
  for (let guard = 0; guard < 1500; guard += 1) {
    let best = null;
    for (const wd of wdays) {
      const t = times[String(wd)];
      if (!t) continue;
      const nextYmd = nextDateForWeekday(cursor, wd, true);
      const ts = `${nextYmd} ${t}:00`;
      if (!best || ts < best) best = ts;
    }
    if (!best) break;
    const ymd = best.slice(0, 10);
    if (ymd > end) break;
    out.push(best);
    // advance cursor to the next day after this occurrence
    cursor = ymdAddDays(ymd, 1);
    if (!cursor) break;
  }
  return out;
}

async function getTodayBakuYmd(dbConn) {
  const { rows } = await dbConn.query(
    `SELECT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS ymd`
  );
  return rows[0]?.ymd || new Date().toISOString().slice(0, 10);
}

/**
 * Ensure lesson rows exist for 8/12 packages up to today+H days.
 * This is intentionally idempotent (ON CONFLICT DO NOTHING).
 */
async function ensurePackLessonsUpTo(dbConn, enrollmentRow, { horizonDays = 30 } = {}) {
  const bt = normalizePackBillingType(enrollmentRow?.billing_type);
  const limit = billingLimit(bt);
  if (!limit) return { ensured: false, inserted: 0 };

  const startYmd = enrollmentRow?.enrollment_start_date
    ? String(enrollmentRow.enrollment_start_date).slice(0, 10)
    : null;
  if (!startYmd || !/^\d{4}-\d{2}-\d{2}$/.test(startYmd)) return { ensured: false, inserted: 0 };

  const wdays = parseWeekdays(enrollmentRow.lesson_weekdays);
  const lt = parseTimes(enrollmentRow.lesson_times);
  if (!wdays.length || !Object.keys(lt).length) return { ensured: false, inserted: 0 };

  const todayBaku = await getTodayBakuYmd(dbConn);
  const horizonYmd = ymdAddDays(todayBaku, horizonDays);
  if (!horizonYmd) return { ensured: false, inserted: 0 };

  // If we already have lessons reasonably into the future, skip.
  const { rows: maxRows } = await dbConn.query(
    `SELECT to_char(MAX(lesson_date AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS max_ymd
     FROM lessons
     WHERE enrollment_id = $1`,
    [enrollmentRow.id]
  );
  const maxYmd = maxRows[0]?.max_ymd || null;
  if (maxYmd && String(maxYmd).slice(0, 10) >= horizonYmd) {
    return { ensured: false, inserted: 0 };
  }

  const starts = enumerateLessonStarts({
    startYmd,
    endYmdInclusive: horizonYmd,
    lessonWeekdays: wdays,
    lessonTimes: lt,
  });
  if (!starts.length) return { ensured: true, inserted: 0 };

  let inserted = 0;
  for (let idx = 0; idx < starts.length; idx += 1) {
    const cycle = Math.floor(idx / limit) + 1;
    const lessonNumber = (idx % limit) + 1;
    const startsAt = starts[idx]; // "YYYY-MM-DD HH:MM:SS" (Baku wall)
    const ymd = startsAt.slice(0, 10);
    const dow = weekdayFromYmd(ymd);
    // Best-effort: if weekday doesn't match, skip (shouldn't happen).
    if (!dow || !wdays.includes(dow)) continue;

    const a = await dbConn.query(
      `INSERT INTO enrollment_lessons (enrollment_id, billing_cycle, lesson_number, starts_at)
       VALUES ($1, $2, $3, $4::timestamp)
       ON CONFLICT (enrollment_id, billing_cycle, lesson_number) DO NOTHING`,
      [enrollmentRow.id, cycle, lessonNumber, startsAt]
    );
    if (a.rowCount > 0) inserted += 1;

    await dbConn.query(
      `INSERT INTO lessons (enrollment_id, student_id, instructor_id, lesson_date, status, lesson_number, billing_cycle)
       VALUES ($1,$2,$3,($4::timestamp AT TIME ZONE 'Asia/Baku'),'pending',$5,$6)
       ON CONFLICT (enrollment_id, billing_cycle, lesson_number) DO NOTHING`,
      [enrollmentRow.id, enrollmentRow.student_id, enrollmentRow.instructor_id, startsAt, lessonNumber, cycle]
    );
  }

  return { ensured: true, inserted };
}

/**
 * Derive package progress purely from scheduled lessons (lessons table):
 * done_total = count of lessons whose derived scheduled_ts <= now.
 * Then set:
 *   billing_cycle = floor(done_total / limit) + 1
 *   lesson_count  = done_total % limit
 *
 * This fixes legacy converted enrollments where attendance wasn't used.
 */
async function syncPackProgressFromLessons(dbConn, enrollmentId, { billingType, limit } = {}) {
  const bt = normalizePackBillingType(billingType);
  const lim = limit != null ? Number(limit) : billingLimit(bt);
  if (!lim) return { synced: false, done_total: 0, billing_cycle: 1, lesson_count: 0 };

  // Load lesson_times for wall-time derivation (same as /payments/my calendar logic)
  const { rows: enrRows } = await dbConn.query(
    `SELECT id, lesson_times
     FROM enrollments
     WHERE id = $1`,
    [enrollmentId]
  );
  const lt = enrRows[0]?.lesson_times ?? null;
  if (!lt) return { synced: false, done_total: 0, billing_cycle: 1, lesson_count: 0 };

  const { rows: agg } = await dbConn.query(
    `WITH enr AS (
       SELECT $1::uuid AS id, $2::jsonb AS lesson_times
     ),
     l AS (
       SELECT
         status,
         billing_cycle,
         lesson_date,
         to_char((lesson_date AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS ymd,
         EXTRACT(ISODOW FROM (lesson_date AT TIME ZONE 'Asia/Baku'))::int AS dow
       FROM lessons
       WHERE enrollment_id = $1
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
     SELECT COUNT(*) FILTER (WHERE scheduled_ts <= NOW() AND status = 'done')::int AS done_total
     FROM sched`,
    [enrollmentId, lt]
  );
  const doneTotal = Number(agg[0]?.done_total ?? 0) || 0;
  const nextCycle = Math.floor(doneTotal / lim) + 1;
  const inCycle = doneTotal % lim;

  await dbConn.query(
    `UPDATE enrollments
     SET billing_type = COALESCE(NULLIF(TRIM(billing_type), ''), $2),
         billing_cycle = $3,
         lesson_count = $4
     WHERE id = $1`,
    [enrollmentId, bt, nextCycle, inCycle]
  );

  return { synced: true, done_total: doneTotal, billing_cycle: nextCycle, lesson_count: inCycle };
}

module.exports = {
  billingLimit,
  normalizePackBillingType,
  ensurePackLessonsUpTo,
  enumerateLessonStarts,
  syncPackProgressFromLessons,
};

