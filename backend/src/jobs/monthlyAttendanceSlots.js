const db = require('../utils/db');
const {
  enumerateLessonYmds,
  bakuTodayYmd,
  parseYmd,
  parseLessonWeekdaysJson,
  ymdFromUtcDate,
  parseYmdUtcNoon,
} = require('../controllers/monthlyAttendanceController');

/**
 * Aktiv aylıq enrollment-lar üçün gələcək dərs günlərində pending slotlar yaradır (cron).
 */
async function extendMonthlyAttendanceSlots() {
  const today = await bakuTodayYmd();
  const horizon = ymdFromUtcDate(new Date(parseYmdUtcNoon(today).getTime() + 180 * 86400000));

  const { rows } = await db.query(
    `SELECT e.id, e.lesson_weekdays, e.enrollment_start_date,
            (SELECT MAX(s.lesson_date) FROM monthly_attendance_slots s WHERE s.enrollment_id = e.id) AS max_d
     FROM enrollments e
     WHERE e.billing_type = 'monthly'
       AND (e.status IS NULL OR LOWER(TRIM(e.status)) = 'active')`
  );

  let totalInserted = 0;
  for (const r of rows) {
    const wdays = parseLessonWeekdaysJson(r.lesson_weekdays);
    if (!wdays.length) continue;

    const anchor = parseYmd(r.enrollment_start_date);
    let start;
    if (r.max_d) {
      const md = typeof r.max_d === 'string' ? r.max_d.slice(0, 10) : ymdFromUtcDate(new Date(r.max_d));
      start = ymdFromUtcDate(new Date(parseYmdUtcNoon(md).getTime() + 86400000));
    } else {
      start = anchor || today;
    }
    if (anchor && start < anchor) start = anchor;
    if (start > horizon) continue;

    const dates = enumerateLessonYmds(start, horizon, wdays);
    if (!dates.length) continue;

    const ins = await db.query(
      `INSERT INTO monthly_attendance_slots (enrollment_id, lesson_date, status, charges_virtual_balance)
       SELECT $1::uuid, d::date, 'pending', FALSE
       FROM unnest($2::date[]) AS d
       ON CONFLICT (enrollment_id, lesson_date) DO NOTHING`,
      [r.id, dates]
    );
    totalInserted += ins.rowCount || 0;
  }
  return { totalInserted, enrollments: rows.length };
}

module.exports = { extendMonthlyAttendanceSlots };
