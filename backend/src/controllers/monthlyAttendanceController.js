const db = require('../utils/db');

function normUuid(id) {
  return String(id || '').trim().toLowerCase().replace(/-/g, '');
}

function sameUuid(a, b) {
  if (a == null || b == null) return false;
  return normUuid(a) === normUuid(b);
}

function parseYmd(v) {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function parseLessonWeekdaysJson(jsonb) {
  if (jsonb == null) return [];
  let arr = jsonb;
  if (typeof arr === 'string') {
    try {
      arr = JSON.parse(arr);
    } catch {
      return [];
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

function parseYmdUtcNoon(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function ymdFromUtcDate(d) {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function ymdFromPgDate(val) {
  if (val == null) return '';
  if (typeof val === 'string') return val.slice(0, 10);
  return ymdFromUtcDate(new Date(val));
}

/** ISO: Bazar=0 → B.e.=1 … Bazar=7 */
function isoDowMon1(d) {
  const w = d.getUTCDay();
  return w === 0 ? 7 : w;
}

function enumerateLessonYmds(startYmd, endYmd, weekdayNums) {
  const days = [...new Set((weekdayNums || []).filter((n) => n >= 1 && n <= 7))].sort((a, b) => a - b);
  const out = [];
  if (!days.length || !startYmd || !endYmd || startYmd > endYmd) return out;
  let cur = parseYmdUtcNoon(startYmd);
  const end = parseYmdUtcNoon(endYmd);
  if (!cur || !end) return out;
  while (cur <= end) {
    if (days.includes(isoDowMon1(cur))) out.push(ymdFromUtcDate(cur));
    cur = new Date(cur.getTime() + 86400000);
  }
  return out;
}

async function bakuTodayYmd() {
  const { rows } = await db.query(
    `SELECT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS ymd`
  );
  return rows[0]?.ymd || new Date().toISOString().slice(0, 10);
}

async function loadMonthlyEnrollment(enrollmentId) {
  const { rows } = await db.query(
    `SELECT e.id, e.instructor_id, e.billing_type, e.lesson_weekdays, e.enrollment_start_date
     FROM enrollments e WHERE e.id = $1`,
    [enrollmentId]
  );
  return rows[0] || null;
}

function assertMonthlyInstructor(req, en) {
  if (!en) return { error: { status: 404, message: 'Tapılmadı' } };
  if (en.billing_type !== 'monthly') {
    return { error: { status: 400, message: 'Bu endpoint yalnız aylıq paket üçündür' } };
  }
  if (req.user.role === 'student') {
    return { error: { status: 403, message: 'İcazə yoxdur' } };
  }
  if (req.user.role === 'instructor' && !sameUuid(en.instructor_id, req.user.id)) {
    return { error: { status: 403, message: 'İcazə yoxdur' } };
  }
  return { en };
}

function addDaysYmd(ymd, n) {
  const d = parseYmdUtcNoon(ymd);
  if (!d) return null;
  return ymdFromUtcDate(new Date(d.getTime() + Number(n) * 86400000));
}

/** GET /monthly/:enrollment_id */
const listMonthlySlots = async (req, res) => {
  try {
    const { enrollment_id } = req.params;
    const fromQ = parseYmd(req.query.from);
    const toQ = parseYmd(req.query.to);
    const en = await loadMonthlyEnrollment(enrollment_id);
    const chk = assertMonthlyInstructor(req, en);
    if (chk.error) return res.status(chk.error.status).json({ success: false, message: chk.error.message });

    const anchor = parseYmd(en.enrollment_start_date) || (await bakuTodayYmd());
    const today = await bakuTodayYmd();
    const from = fromQ || anchor;
    const to = toQ || addDaysYmd(today, 120) || today;
    if (from > to) {
      return res.status(400).json({ success: false, message: 'from/to tarix aralığı yanlışdır' });
    }

    const wdays = parseLessonWeekdaysJson(en.lesson_weekdays);
    if (!wdays.length) {
      return res.json({
        success: true,
        anchor_date: anchor,
        today_baku: today,
        slots: [],
        next_lesson: null,
        message: 'Dərs günləri təyin edilməyib',
      });
    }

    const dates = enumerateLessonYmds(from, to, wdays);
    if (dates.length > 240) {
      return res.status(400).json({
        success: false,
        message: 'Çox uzun aralıq — from/to tarixlərini daraldın (maks. ~240 dərs günü göstərilir)',
      });
    }
    const { rows: slots } = await db.query(
      `SELECT id, lesson_date, status, notes
       FROM monthly_attendance_slots
       WHERE enrollment_id = $1 AND lesson_date >= $2::date AND lesson_date <= $3::date
       ORDER BY lesson_date`,
      [enrollment_id, from, to]
    );
    const map = new Map();
    for (const r of slots) {
      map.set(ymdFromPgDate(r.lesson_date), r);
    }

    const merged = dates.map((d) => {
      const row = map.get(d);
      return {
        lesson_date: d,
        slot_id: row?.id || null,
        status: row?.status || null,
        notes: row?.notes || null,
      };
    });

    const futureDates = enumerateLessonYmds(today, to, wdays).filter((d) => d >= today);
    let next_lesson = null;
    for (const d of futureDates) {
      const row = map.get(d);
      const st = row?.status || null;
      if (!st || st === 'pending') {
        next_lesson = {
          lesson_date: d,
          status: st || 'pending',
          slot_id: row?.id || null,
        };
        break;
      }
    }

    res.json({
      success: true,
      anchor_date: anchor,
      today_baku: today,
      slots: merged,
      next_lesson,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** POST /monthly/:enrollment_id/generate — pending slotlar (mövcudları silmir) */
const generateMonthlySlots = async (req, res) => {
  try {
    const { enrollment_id } = req.params;
    const df = parseYmd(req.body.date_from);
    const dt = parseYmd(req.body.date_to);
    const en = await loadMonthlyEnrollment(enrollment_id);
    const chk = assertMonthlyInstructor(req, en);
    if (chk.error) return res.status(chk.error.status).json({ success: false, message: chk.error.message });

    const today = await bakuTodayYmd();
    const anchor = parseYmd(en.enrollment_start_date) || today;
    const wdays = parseLessonWeekdaysJson(en.lesson_weekdays);
    if (!wdays.length) {
      return res.status(400).json({ success: false, message: 'Dərs günləri boşdur' });
    }

    const start = df || today;
    let end = dt || addDaysYmd(start, 120) || start;
    const maxEnd = addDaysYmd(start, 400) || end;
    if (end > maxEnd) end = maxEnd;
    if (start > end) {
      return res.status(400).json({ success: false, message: 'Tarix aralığı yanlışdır' });
    }

    const dates = enumerateLessonYmds(start, end, wdays);
    if (dates.length > 260) {
      return res.status(400).json({ success: false, message: 'Çox uzun aralıq (maks. ~260 dərs günü)' });
    }
    if (!dates.length) {
      return res.json({ success: true, inserted: 0 });
    }

    const { rowCount } = await db.query(
      `INSERT INTO monthly_attendance_slots (enrollment_id, lesson_date, status)
       SELECT $1::uuid, d::date, 'pending'
       FROM unnest($2::date[]) AS d
       ON CONFLICT (enrollment_id, lesson_date) DO NOTHING`,
      [enrollment_id, dates]
    );

    res.json({ success: true, inserted: rowCount, total_candidates: dates.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** POST /monthly/:enrollment_id/bulk */
const bulkMonthlySlots = async (req, res) => {
  try {
    const { enrollment_id } = req.params;
    const { action } = req.body;
    const df = parseYmd(req.body.date_from);
    const dt = parseYmd(req.body.date_to);
    if (!['attended', 'absent', 'archived'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action: attended | absent | archived olmalıdır' });
    }
    if (!df || !dt || df > dt) {
      return res.status(400).json({ success: false, message: 'date_from və date_to tələb olunur (YYYY-MM-DD)' });
    }

    const en = await loadMonthlyEnrollment(enrollment_id);
    const chk = assertMonthlyInstructor(req, en);
    if (chk.error) return res.status(chk.error.status).json({ success: false, message: chk.error.message });

    const wdays = parseLessonWeekdaysJson(en.lesson_weekdays);
    const dates = enumerateLessonYmds(df, dt, wdays);
    if (dates.length > 400) {
      return res.status(400).json({ success: false, message: 'Çox uzun aralıq (maks. ~400 dərs günü)' });
    }
    if (!dates.length) {
      return res.json({ success: true, updated: 0 });
    }

    const note =
      action === 'archived'
        ? `[Arxiv toplu ${df}–${dt}]`
        : action === 'attended'
          ? `[Toplu Gəldi ${df}–${dt}]`
          : `[Toplu Gəlmədi ${df}–${dt}]`;

    const { rowCount } = await db.query(
      `INSERT INTO monthly_attendance_slots (enrollment_id, lesson_date, status, notes)
       SELECT $1::uuid, d::date, $3, $4
       FROM unnest($2::date[]) AS d
       ON CONFLICT (enrollment_id, lesson_date)
       DO UPDATE SET status = EXCLUDED.status, notes = COALESCE(EXCLUDED.notes, monthly_attendance_slots.notes), updated_at = NOW()`,
      [enrollment_id, dates, action, note.slice(0, 500)]
    );

    res.json({ success: true, updated: rowCount, days: dates.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** PUT /monthly/:enrollment_id/day */
const putMonthlyDay = async (req, res) => {
  try {
    const { enrollment_id } = req.params;
    const ld = parseYmd(req.body.lesson_date);
    const { status, notes } = req.body;
    if (!ld) return res.status(400).json({ success: false, message: 'lesson_date (YYYY-MM-DD) tələb olunur' });
    if (!['pending', 'attended', 'absent', 'archived'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status yanlışdır' });
    }

    const en = await loadMonthlyEnrollment(enrollment_id);
    const chk = assertMonthlyInstructor(req, en);
    if (chk.error) return res.status(chk.error.status).json({ success: false, message: chk.error.message });

    const wdays = parseLessonWeekdaysJson(en.lesson_weekdays);
    if (!wdays.includes(isoDowMon1(parseYmdUtcNoon(ld)))) {
      return res.status(400).json({ success: false, message: 'Bu tarix seçilmiş dərs günlərinə düşmür' });
    }

    const { rows } = await db.query(
      `INSERT INTO monthly_attendance_slots (enrollment_id, lesson_date, status, notes)
       VALUES ($1, $2::date, $3, $4)
       ON CONFLICT (enrollment_id, lesson_date)
       DO UPDATE SET status = EXCLUDED.status, notes = COALESCE(EXCLUDED.notes, monthly_attendance_slots.notes), updated_at = NOW()
       RETURNING *`,
      [enrollment_id, ld, status, notes || null]
    );

    res.json({ success: true, slot: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  listMonthlySlots,
  generateMonthlySlots,
  bulkMonthlySlots,
  putMonthlyDay,
  enumerateLessonYmds,
  bakuTodayYmd,
  parseYmd,
  parseYmdUtcNoon,
  ymdFromUtcDate,
  parseLessonWeekdaysJson,
};
