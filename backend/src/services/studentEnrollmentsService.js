const db = require('../utils/db');
const { parseLessonWeekdaysJson } = require('../controllers/monthlyAttendanceController');
const { parseLessonEndTimes } = require('../utils/lessonScheduleTimes');

function parseLessonTimesJson(raw, lessonWeekdays) {
  if (raw == null) return {};
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const out = {};
  const days = Array.isArray(lessonWeekdays) ? lessonWeekdays : [];
  for (const d of days) {
    const v = obj[d] ?? obj[String(d)];
    if (v == null || v === '') continue;
    const s = String(v).trim();
    if (!/^\d{1,2}:\d{2}/.test(s)) continue;
    const [h, m] = s.split(':').map(Number);
    if (h < 0 || h > 23 || m < 0 || m > 59) continue;
    out[String(d)] = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return out;
}

function timeToHm(t) {
  const s = String(t || '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function scheduleBundle(lesson_weekdays, lesson_times, lesson_end_times) {
  const lt = lesson_times || {};
  const let_ = parseLessonEndTimes(lesson_end_times, lesson_weekdays, lt);
  return { lesson_weekdays, lesson_times: lt, lesson_end_times: let_ };
}

/** Qrupda artıq təyin olunmuş həftəlik cədvəl (aktiv tələbə, qrup defaultu və ya teacher_schedules). */
async function getGroupLessonSchedule(groupId) {
  if (!groupId) return { lesson_weekdays: [], lesson_times: {}, lesson_end_times: {} };

  const { rows: peer } = await db.query(
    `SELECT e.lesson_weekdays, e.lesson_times, e.lesson_end_times
     FROM enrollments e
     WHERE e.group_id = $1
       AND (e.deleted_at IS NULL)
       AND COALESCE(LOWER(TRIM(e.status)), 'active') = 'active'
       AND e.lesson_weekdays IS NOT NULL
       AND jsonb_typeof(e.lesson_weekdays) = 'array'
       AND jsonb_array_length(e.lesson_weekdays) > 0
     ORDER BY e.configured_at DESC NULLS LAST, e.enrolled_at ASC
     LIMIT 1`,
    [groupId],
  );
  if (peer[0]) {
    const lesson_weekdays = parseLessonWeekdaysJson(peer[0].lesson_weekdays);
    if (lesson_weekdays.length) {
      const lesson_times = parseLessonTimesJson(peer[0].lesson_times, lesson_weekdays);
      return scheduleBundle(lesson_weekdays, lesson_times, peer[0].lesson_end_times);
    }
  }

  const { rows: grpRows } = await db.query(
    `SELECT default_lesson_weekdays, default_lesson_times, default_lesson_end_times
     FROM instructor_groups
     WHERE id = $1`,
    [groupId],
  );
  const grp = grpRows[0];
  if (grp) {
    const lesson_weekdays = parseLessonWeekdaysJson(grp.default_lesson_weekdays);
    const lesson_times = parseLessonTimesJson(grp.default_lesson_times, lesson_weekdays);
    if (lesson_weekdays.length && Object.keys(lesson_times).length) {
      return scheduleBundle(lesson_weekdays, lesson_times, grp.default_lesson_end_times);
    }
  }

  const { rows: slots } = await db.query(
    `SELECT day_of_week, start_time, end_time
     FROM teacher_schedules
     WHERE group_id = $1
     ORDER BY day_of_week, start_time`,
    [groupId],
  );
  const lesson_weekdays = [];
  const lesson_times = {};
  const lesson_end_times = {};
  for (const slot of slots) {
    const d = parseInt(String(slot.day_of_week), 10);
    if (!Number.isFinite(d) || d < 1 || d > 7) continue;
    if (!lesson_weekdays.includes(d)) lesson_weekdays.push(d);
    const hm = timeToHm(slot.start_time);
    const endHm = timeToHm(slot.end_time);
    if (hm && !lesson_times[String(d)]) lesson_times[String(d)] = hm;
    if (endHm && !lesson_end_times[String(d)]) lesson_end_times[String(d)] = endHm;
  }
  lesson_weekdays.sort((a, b) => a - b);
  return scheduleBundle(lesson_weekdays, lesson_times, lesson_end_times);
}

async function applyGroupScheduleToEnrollment(enrollmentId, groupId) {
  const sched = await getGroupLessonSchedule(groupId);
  if (!sched.lesson_weekdays.length) return false;
  await db.query(
    `UPDATE enrollments
     SET lesson_weekdays = $2::jsonb,
         lesson_times = $3::jsonb,
         lesson_end_times = $4::jsonb
     WHERE id = $1`,
    [
      enrollmentId,
      JSON.stringify(sched.lesson_weekdays),
      JSON.stringify(sched.lesson_times),
      JSON.stringify(sched.lesson_end_times || {}),
    ],
  );
  return true;
}

function enrichRowLessonSchedule(row) {
  if (!row || !row.group_id) return row;
  const wdays = parseLessonWeekdaysJson(row.lesson_weekdays);
  if (wdays.length) return row;
  const cached = row._groupSchedule;
  if (!cached?.lesson_weekdays?.length) return row;
  return {
    ...row,
    lesson_weekdays: cached.lesson_weekdays,
    lesson_times: cached.lesson_times,
    lesson_end_times: cached.lesson_end_times || {},
  };
}

async function enrichStudentsWithGroupSchedule(rows) {
  if (!Array.isArray(rows) || !rows.length) return rows;
  const cache = new Map();
  const out = [];
  for (const row of rows) {
    const wdays = parseLessonWeekdaysJson(row.lesson_weekdays);
    if (wdays.length || !row.group_id) {
      out.push(row);
      continue;
    }
    const gid = String(row.group_id);
    if (!cache.has(gid)) {
      cache.set(gid, await getGroupLessonSchedule(row.group_id));
    }
    out.push(enrichRowLessonSchedule({ ...row, _groupSchedule: cache.get(gid) }));
  }
  return out.map((r) => {
    const { _groupSchedule, ...rest } = r;
    return rest;
  });
}

const GROUP_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#6366f1',
  '#14b8a6',
];

function colorForGroup(groupId) {
  const s = String(groupId || 'default');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return GROUP_COLORS[Math.abs(h) % GROUP_COLORS.length];
}

async function listActiveEnrollmentsForStudent(studentId) {
  const { rows } = await db.query(
    `SELECT
       e.id AS enrollment_id,
       e.instructor_id,
       e.group_id,
       e.subject_id,
       e.status,
       e.enrolled_at,
       e.configured_at,
       e.enrollment_start_date,
       e.lesson_weekdays,
       e.lesson_times,
       e.lesson_end_times,
       ig.name AS group_name,
       ig.join_code,
       COALESCE(NULLIF(TRIM(ist.name), ''), 'Sahəsiz') AS subject_name,
       u.full_name AS instructor_name,
       u.phone AS instructor_phone,
       COALESCE(cnt.n, 0)::int AS student_count
     FROM enrollments e
     LEFT JOIN instructor_groups ig ON ig.id = e.group_id
     LEFT JOIN instructor_subjects ist ON ist.id = e.subject_id
     LEFT JOIN users u ON u.id = e.instructor_id AND u.deleted_at IS NULL
     LEFT JOIN (
       SELECT e2.group_id, COUNT(DISTINCT e2.student_id) AS n
       FROM enrollments e2
       JOIN users su ON su.id = e2.student_id AND su.is_active = TRUE AND su.deleted_at IS NULL
       WHERE e2.deleted_at IS NULL
         AND COALESCE(LOWER(TRIM(e2.status)), 'active') = 'active'
         AND e2.group_id IS NOT NULL
       GROUP BY e2.group_id
     ) cnt ON cnt.group_id = e.group_id
     WHERE e.student_id = $1
       AND (e.deleted_at IS NULL)
       AND COALESCE(LOWER(TRIM(e.status)), 'active') IN ('active', 'pending_setup', 'pending_approval')
     ORDER BY e.enrolled_at DESC NULLS LAST, ig.name ASC NULLS LAST`,
    [studentId],
  );

  const cache = new Map();
  const enriched = [];
  for (const r of rows) {
    let lesson_weekdays = r.lesson_weekdays;
    let lesson_times = r.lesson_times;
    let lesson_end_times = r.lesson_end_times;
    const wdays = parseLessonWeekdaysJson(lesson_weekdays);
    const ltKeys = parseLessonTimesJson(lesson_times, wdays);
    let let_ = parseLessonEndTimes(lesson_end_times, wdays, ltKeys);
    if (!wdays.length && r.group_id) {
      const gid = String(r.group_id);
      if (!cache.has(gid)) {
        cache.set(gid, await getGroupLessonSchedule(r.group_id));
      }
      const sched = cache.get(gid);
      if (sched?.lesson_weekdays?.length) {
        lesson_weekdays = sched.lesson_weekdays;
        lesson_times = sched.lesson_times;
        let_ = sched.lesson_end_times || {};
      }
    } else if (wdays.length) {
      lesson_times = ltKeys;
      let_ = let_;
    }
    enriched.push({
      ...r,
      lesson_weekdays,
      lesson_times,
      lesson_end_times: let_,
      join_date: r.enrollment_start_date || r.enrolled_at,
      color: colorForGroup(r.group_id || r.enrollment_id),
    });
  }
  return enriched;
}

async function resolveEnrollmentScope(studentId, enrollmentId) {
  if (!enrollmentId) return null;
  const { rows } = await db.query(
    `SELECT id AS enrollment_id, instructor_id, group_id, subject_id
     FROM enrollments
     WHERE id = $1
       AND student_id = $2
       AND (deleted_at IS NULL)
       AND COALESCE(LOWER(TRIM(status)), 'active') IN ('active', 'pending_setup')
     LIMIT 1`,
    [enrollmentId, studentId],
  );
  return rows[0] || null;
}

module.exports = {
  GROUP_COLORS,
  colorForGroup,
  getGroupLessonSchedule,
  applyGroupScheduleToEnrollment,
  enrichStudentsWithGroupSchedule,
  listActiveEnrollmentsForStudent,
  resolveEnrollmentScope,
};
