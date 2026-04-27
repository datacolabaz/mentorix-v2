const db = require('../utils/db');
const { computeMonthlyCycleProgress, getTodayBakuYmd, toYmd } = require('../services/subscriptionBilling');

const BILLING_MESSAGE =
  'Hörmətli tələbə, aylıq abunəliyinizin bitməsinə 2 gün qalıb. Davam etmək üçün ödənişi yeniləməyiniz xahiş olunur.';

function clampLimit(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 50;
  return Math.min(200, Math.max(20, Math.trunc(x)));
}

function normDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

function addDaysYmd(ymd, days) {
  const s = String(ymd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const n = Number(days || 0);
  const dt = new Date(`${s}T12:00:00Z`);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function compareYmd(a, b) {
  const as = String(a || '').slice(0, 10);
  const bs = String(b || '').slice(0, 10);
  if (as < bs) return -1;
  if (as > bs) return 1;
  return 0;
}

function ymdFromTsBaku(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Baku',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function parseLessonWeekdays(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const x of v) {
    const n = Number(x);
    if (Number.isFinite(n) && n >= 1 && n <= 7 && !out.includes(n)) out.push(n);
  }
  return out.sort((a, b) => a - b);
}

function listUpcomingLessonYmds({ startYmd, weekdays, maxDays }) {
  const s = String(startYmd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return [];
  const wd = parseLessonWeekdays(weekdays);
  if (!wd.length) return [];

  const start = new Date(`${s}T12:00:00Z`);
  if (Number.isNaN(start.getTime())) return [];

  const out = [];
  const days = Math.min(180, Math.max(1, Math.trunc(Number(maxDays || 90) || 90)));
  for (let i = 0; i <= days; i += 1) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    // Convert UTC noon date into Baku weekday by using UTC weekday mapping at noon (stable)
    const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // 1..7
    if (!wd.includes(dow)) continue;
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function normalizeType(v) {
  const t = String(v || '').trim().toLowerCase();
  if (t === 'otp') return 'otp';
  if (t === 'payment' || t === 'payment_reminder') return 'payment';
  if (t === 'system') return 'system';
  return '';
}

function normalizeStatus(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return '';
  if (s === 'sent') return 'sent';
  if (s === 'pending') return 'pending';
  if (s === 'failed') return 'failed';
  return s; // allow provider statuses, but treat failed:<reason> as failed in filters below
}

const getSmsLogs = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const limit = clampLimit(req.query.limit);
    const type = normalizeType(req.query.type); // payment | otp
    const status = normalizeStatus(req.query.status); // sent | failed | pending
    const date = String(req.query.date || '').trim(); // YYYY-MM-DD (optional)
    const phoneQ = normDigits(req.query.phone);

    const where = [];
    const params = [instructorId];

    if (phoneQ) {
      const { rows: allowRows } = await db.query(
        `SELECT DISTINCT norm_phone FROM (
           SELECT regexp_replace(u.phone, '\\\\D', '', 'g') AS norm_phone
           FROM users u
           JOIN enrollments e ON e.student_id = u.id
           WHERE e.instructor_id = $1
             AND COALESCE(NULLIF(LOWER(TRIM(e.status)), ''), 'active') = 'active'
             AND u.phone IS NOT NULL
           UNION
           SELECT regexp_replace(sp.parent_phone, '\\\\D', '', 'g') AS norm_phone
           FROM student_profiles sp
           JOIN enrollments e2 ON e2.student_id = sp.user_id
           WHERE e2.instructor_id = $1
             AND COALESCE(NULLIF(LOWER(TRIM(e2.status)), ''), 'active') = 'active'
             AND sp.parent_phone IS NOT NULL
         ) x
         WHERE norm_phone IS NOT NULL AND norm_phone <> ''`,
        [instructorId]
      );
      const allowed = new Set((allowRows || []).map((r) => String(r.norm_phone || '')).filter(Boolean));
      if (!allowed.has(phoneQ)) {
        return res.status(403).json({
          success: false,
          code: 'PHONE_NOT_ALLOWED',
          message: 'Bu nömrəyə baxmaq üçün icazəniz yoxdur',
        });
      }
      params.push(phoneQ);
      where.push(`b.norm_phone = $${params.length}`);
    }

    // Scope: instructor direct sends OR student/parent phones for their active enrollments
    where.push(`(
      b.instructor_id = $1 OR b.norm_phone IN (
        SELECT norm_phone FROM (
          SELECT regexp_replace(u.phone, '\\\\D', '', 'g') AS norm_phone
          FROM users u
          JOIN enrollments e ON e.student_id = u.id
          WHERE e.instructor_id = $1
            AND COALESCE(NULLIF(LOWER(TRIM(e.status)), ''), 'active') = 'active'
            AND u.phone IS NOT NULL
          UNION
          SELECT regexp_replace(sp.parent_phone, '\\\\D', '', 'g') AS norm_phone
          FROM student_profiles sp
          JOIN enrollments e2 ON e2.student_id = sp.user_id
          WHERE e2.instructor_id = $1
            AND COALESCE(NULLIF(LOWER(TRIM(e2.status)), ''), 'active') = 'active'
            AND sp.parent_phone IS NOT NULL
        ) x
      )
    )`);

    // Backward compatible inference for logs that predate sms_logs.type.
    // OTP-like heuristics are duplicated in JS mapping below.
    const otpLikeSql = `(
      b.message ILIKE '%kodunuz%'
      OR b.message ~* '^\\s*mentorix\\s*:\\s*\\d{3,8}\\b'
      OR b.message ILIKE '%otp%'
      OR b.message ILIKE '%pin%'
    )`;

    if (type) {
      params.push(type);
      if (type === 'payment') {
        // Include explicit payment types OR inferred payment (type null) based on message content.
        // Many legacy "billing reminder" logs stored the kind in `status` and left `type` empty.
        where.push(`(
          LOWER(COALESCE(b.type, '')) IN ('payment', 'payment_reminder')
          OR (b.type IS NULL AND NOT ${otpLikeSql})
        )`);
      } else {
        // Include explicit OTP type OR inferred OTP when type is missing.
        where.push(`(
          LOWER(COALESCE(b.type, '')) = $${params.length}
          OR (b.type IS NULL AND ${otpLikeSql})
        )`);
      }
    }

    if (status) {
      if (status === 'failed') {
        where.push(`(b.status ILIKE 'failed:%' OR LOWER(TRIM(b.status)) = 'failed')`);
      } else if (status === 'pending') {
        where.push(`LOWER(TRIM(b.status)) = 'pending'`);
      } else if (status === 'sent') {
        // Treat any non-failed/non-pending provider/custom status as "sent".
        // This fixes legacy logs that stored billing kind (e.g. billing_monthly_2d) in `status`.
        where.push(`NOT (
          LOWER(TRIM(b.status)) = 'pending'
          OR LOWER(TRIM(b.status)) = 'failed'
          OR b.status ILIKE 'failed:%'
        )`);
      }
    }

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      params.push(date);
      where.push(`to_char(b.ts, 'YYYY-MM-DD') = $${params.length}`);
    }

    const { rows } = await db.query(
      `WITH base AS (
         SELECT
           sl.*,
           regexp_replace(sl.phone, '\\\\D', '', 'g') AS norm_phone,
           COALESCE(sl.created_at, sl.sent_at) AS ts
         FROM sms_logs sl
       )
       SELECT
         b.id,
         b.student_id,
         su.full_name AS student_name,
         b.type,
         b.phone,
         b.message,
         b.status,
         b.package_type,
         b.ts AS created_at
       FROM base b
       LEFT JOIN users su ON su.id = b.student_id
       WHERE ${where.join(' AND ')}
       ORDER BY b.ts DESC
       LIMIT ${limit}`,
      params
    );

    // Derive missing type/package_type for older logs when possible (best-effort)
    const items = (rows || []).map((r) => {
      const msg = String(r.message || '').trim();
      const otpLike =
        /\bkodunuz\b/i.test(msg) ||
        /^mentorix\s*:\s*\d{3,8}\b/i.test(msg) ||
        /\bOTP\b/i.test(msg) ||
        /\bPIN\b/i.test(msg) ||
        /OTP\s*yox/i.test(msg);
      const examLike =
        /\bimtahan/i.test(msg) ||
        /\bbal\b/i.test(msg) ||
        /\bnetice\b/i.test(msg) ||
        /\bnəticə\b/i.test(msg);
      const billingLike = /abunəliyinizin bitməsinə 2 gün qalıb/i.test(msg) || /\b(?:ödəniş|odenis)\b/i.test(msg);
      const inferredType = otpLike ? 'otp' : billingLike ? 'payment' : examLike ? 'system' : 'system';

      const stRaw = String(r.status || '').trim();
      const isFailed = stRaw === 'failed' || stRaw.toLowerCase().startsWith('failed:');
      const isPending = stRaw.toLowerCase() === 'pending';
      const reason = isFailed && stRaw.includes(':') ? stRaw.split(':').slice(1).join(':').trim() : null;

      const pkgRaw = r.package_type ? String(r.package_type) : '';
      const pkg =
        pkgRaw === '8_lessons' || pkgRaw === '8' ? '8' : pkgRaw === '12_lessons' || pkgRaw === '12' ? '12' : pkgRaw === 'monthly' ? 'monthly' : null;

      return {
        id: r.id,
        student_id: r.student_id || null,
        student_name: r.student_name || null,
        type: normalizeType(r.type) || inferredType,
        phone: r.phone,
        message: r.message,
        status: isFailed ? 'failed' : isPending ? 'pending' : 'sent',
        reason,
        package_type: pkg,
        created_at: r.created_at,
        createdAt: r.created_at,
      };
    });

    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

async function remainingLessonsCalendar(enrollmentId, cycle) {
  const { rows: enRows } = await db.query(`SELECT lesson_times FROM enrollments WHERE id = $1`, [enrollmentId]);
  const lt = enRows[0]?.lesson_times ?? null;
  if (!lt) return null;

  const { rows: agg } = await db.query(
    `WITH enr AS (
       SELECT $1::uuid AS id, $2::jsonb AS lesson_times
     ),
     l AS (
       SELECT
         lesson_date,
         to_char((lesson_date AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS ymd,
         EXTRACT(ISODOW FROM (lesson_date AT TIME ZONE 'Asia/Baku'))::int AS dow
       FROM lessons
       WHERE enrollment_id = $1 AND billing_cycle = $3
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
    [enrollmentId, lt, cycle]
  );

  const total = Number(agg[0]?.total ?? 0) || 0;
  const used = Math.min(total, Math.max(0, Number(agg[0]?.used ?? 0) || 0));
  return Math.max(0, total - used);
}

async function nextLessonMeta(enrollmentId, cycle) {
  const { rows } = await db.query(
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
       WHERE enrollment_id = $1
         AND billing_cycle = $2
         AND status = 'pending'
     ),
     sched AS (
       SELECT
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
     SELECT ymd, scheduled_ts
     FROM sched
     WHERE scheduled_ts > NOW()
     ORDER BY scheduled_ts
     LIMIT 1`,
    [enrollmentId, cycle]
  );
  return rows[0] || null;
}

const getSmsPlan = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const days = Math.min(90, Math.max(1, Math.trunc(Number(req.query.days || 30) || 30)));
    const todayBaku = await getTodayBakuYmd(db);
    const endYmd = addDaysYmd(todayBaku, days);
    const debug = String(req.query.debug || '').trim() === '1';
    const debugSkipped = [];

    const { rows } = await db.query(
      `SELECT
         e.id AS enrollment_id,
         e.billing_type,
         e.billing_cycle,
         COALESCE(att.max_lesson_number, e.lesson_count, 0) AS lesson_count,
         e.lesson_weekdays,
         e.lesson_times,
         e.enrollment_start_date,
         COALESCE(e.notifications_enabled, TRUE) AS notifications_enabled,
         COALESCE(ip.alert_lessons_before, 2) AS alert_lessons_before,
         su.id AS student_id,
         su.full_name AS student_name,
         su.phone AS student_phone,
         sp.parent_phone
       FROM enrollments e
       LEFT JOIN LATERAL (
         SELECT COALESCE(MAX(a.lesson_number), 0)::int AS max_lesson_number
         FROM attendance a
         WHERE a.enrollment_id = e.id
           AND a.billing_cycle = e.billing_cycle
       ) att ON TRUE
       JOIN instructor_profiles ip ON ip.user_id = e.instructor_id
       JOIN users su ON su.id = e.student_id
       LEFT JOIN student_profiles sp ON sp.user_id = e.student_id
       WHERE e.instructor_id = $1
         AND (e.status IS NULL OR LOWER(TRIM(e.status)) = 'active')
         AND su.is_active = TRUE`,
      [instructorId]
    );

    const items = [];
    for (const r of rows) {
      if (!r.notifications_enabled) {
        if (debug && debugSkipped.length < 100) {
          debugSkipped.push({ enrollment_id: r.enrollment_id, billing_type: r.billing_type, reason: 'notifications_disabled' });
        }
        continue;
      }

      const studentName = r.student_name || null;
      const phones = [r.student_phone, r.parent_phone].filter((p) => String(p || '').trim());
      if (!phones.length) {
        if (debug && debugSkipped.length < 100) {
          debugSkipped.push({ enrollment_id: r.enrollment_id, billing_type: r.billing_type, reason: 'no_phone' });
        }
        continue;
      }

      const billingType = String(r.billing_type || '').trim();
      const cycle = Number(r.billing_cycle || 1) || 1;

      if (billingType === 'monthly') {
        const anchorYmd = toYmd(r.enrollment_start_date);
        if (!anchorYmd) {
          if (debug && debugSkipped.length < 100) {
            debugSkipped.push({ enrollment_id: r.enrollment_id, billing_type: billingType, reason: 'missing_anchor_date' });
          }
          continue;
        }
        const prog = computeMonthlyCycleProgress({ anchor_ymd: anchorYmd, today_ymd: todayBaku });
        const cycleEnd = prog?.cycle_end_ymd ? String(prog.cycle_end_ymd).slice(0, 10) : null;
        const triggerYmd = cycleEnd ? addDaysYmd(cycleEnd, -2) : null;
        if (!triggerYmd || compareYmd(triggerYmd, todayBaku) < 0 || compareYmd(triggerYmd, endYmd) > 0) {
          if (debug && debugSkipped.length < 100) {
            debugSkipped.push({
              enrollment_id: r.enrollment_id,
              billing_type: billingType,
              reason: 'trigger_out_of_range',
              trigger_ymd: triggerYmd,
              range: { from: todayBaku, to: endYmd },
            });
          }
          continue;
        }

        for (const phone of phones) {
          items.push({
            id: `plan_monthly_2d_${r.enrollment_id}_${normDigits(phone)}_${triggerYmd}`,
            student_id: r.student_id || null,
            student_name: studentName,
            type: 'payment',
            phone,
            message: BILLING_MESSAGE,
            status: 'scheduled',
            reason: null,
            package_type: 'monthly',
            created_at: `${triggerYmd}T09:00:00.000Z`,
            createdAt: `${triggerYmd}T09:00:00.000Z`,
            students: studentName ? [studentName] : [],
          });
        }
        continue;
      }

      if (billingType === '8_lessons' || billingType === '12_lessons') {
        // For 8/12 lesson packs, payment reminder is sent on attendance marking when lesson_number hits:
        // alertAt = limit - alert_lessons_before. Plan it using enrollment_lessons schedule when available.
        const limit = billingType === '8_lessons' ? 8 : 12;
        const alertBefore = Math.min(limit - 1, Math.max(1, Number(r.alert_lessons_before ?? 2) || 2));
        const alertAt = Math.max(1, limit - alertBefore);
        const lessonCount = Number(r.lesson_count ?? 0) || 0;
        if (lessonCount >= alertAt) {
          if (debug && debugSkipped.length < 100) {
            debugSkipped.push({
              enrollment_id: r.enrollment_id,
              billing_type: billingType,
              reason: 'already_past_alert_point',
              lesson_count: lessonCount,
              alert_at: alertAt,
            });
          }
          continue;
        }

        const { rows: lr } = await db.query(
          `SELECT starts_at
           FROM enrollment_lessons
           WHERE enrollment_id = $1
             AND billing_cycle = $2
             AND lesson_number = $3
             AND starts_at > NOW()
           LIMIT 1`,
          [r.enrollment_id, cycle, alertAt]
        );
        let triggerYmd = ymdFromTsBaku(lr[0]?.starts_at);
        if (!triggerYmd) {
          // Fallback: if enrollment_lessons aren't generated yet, approximate next occurrences by weekly schedule.
          // Prefer enrollment.lesson_weekdays, otherwise derive weekdays from teacher_schedules.
          let weekdays = r.lesson_weekdays;
          if (!parseLessonWeekdays(weekdays).length) {
            const { rows: schedRows } = await db.query(
              `SELECT DISTINCT day_of_week
               FROM teacher_schedules
               WHERE enrollment_id = $1
                 AND instructor_id = $2
                 AND is_occupied = TRUE`,
              [r.enrollment_id, instructorId]
            );
            weekdays = (schedRows || []).map((x) => x.day_of_week).filter(Boolean);
          }
          const upcoming = listUpcomingLessonYmds({ startYmd: todayBaku, weekdays, maxDays: days });
          const idx = Math.max(0, (alertAt - 1) - lessonCount);
          triggerYmd = upcoming[idx] || null;
        }
        if (!triggerYmd || compareYmd(triggerYmd, todayBaku) < 0 || compareYmd(triggerYmd, endYmd) > 0) {
          if (debug && debugSkipped.length < 100) {
            debugSkipped.push({
              enrollment_id: r.enrollment_id,
              billing_type: billingType,
              reason: triggerYmd ? 'trigger_out_of_range' : 'no_schedule_for_pack',
              trigger_ymd: triggerYmd,
              lesson_count: lessonCount,
              alert_at: alertAt,
              range: { from: todayBaku, to: endYmd },
            });
          }
          continue;
        }

        const pkg = billingType === '8_lessons' ? '8' : '12';
        for (const phone of phones) {
          items.push({
            id: `plan_pkg_alert_${r.enrollment_id}_${normDigits(phone)}_${triggerYmd}`,
            student_id: r.student_id || null,
            student_name: studentName,
            type: 'payment',
            phone,
            message: `Mentorix: ${studentName || 'tələbə'} üçün ${limit - alertAt} dərs qalır. Ödəniş etməyi unutmayın!`,
            status: 'scheduled',
            reason: null,
            package_type: pkg,
            created_at: `${triggerYmd}T09:00:00.000Z`,
            createdAt: `${triggerYmd}T09:00:00.000Z`,
            students: studentName ? [studentName] : [],
          });
        }
      }
    }

    items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    res.json({
      success: true,
      items,
      range: { from: todayBaku, to: endYmd, days },
      ...(debug ? { debug: { skipped: debugSkipped } } : {}),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getSmsLogs, getSmsPlan };

