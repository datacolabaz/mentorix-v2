const db = require('../utils/db');
const {
  bakuTodayYmd,
  parseLessonWeekdaysJson,
  parseYmdUtcNoon,
  ymdFromUtcDate,
} = require('./monthlyAttendanceController');

const listStudents = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const instructorId =
      req.user.id != null ? String(req.user.id).trim().toLowerCase().replace(/-/g, '') : '';

    const select = `SELECT u.id, u.full_name, u.email, u.phone,
              sp.parent_id, sp.grade,
              sp.monthly_fee,
              COALESCE(NULLIF(TRIM(sp.parent_name), ''), pu.full_name) AS parent_name,
              COALESCE(NULLIF(TRIM(sp.parent_phone), ''), pu.phone) AS parent_phone,
              e.id AS enrollment_id, e.billing_type, e.lesson_count, e.billing_cycle,
              e.lesson_weekdays, e.lesson_times,
              e.enrollment_start_date,
              e.billing_timing,
              COALESCE(e.payment_plan, 'full') AS payment_plan,
              e.subject_id, e.group_id,
              ist.name AS track_subject_name,
              ig.name AS track_group_name,
              CASE
                WHEN e.billing_type IN ('8_lessons','12_lessons') THEN (
                  SELECT COUNT(*)::int
                  FROM lessons l
                  WHERE l.enrollment_id = e.id
                    AND l.billing_cycle = e.billing_cycle
                    AND l.lesson_date <= NOW()
                )
                ELSE NULL
              END AS calendar_used_lessons,
              CASE
                WHEN e.billing_type IN ('8_lessons','12_lessons') THEN (
                  SELECT COUNT(*)::int
                  FROM lessons l
                  WHERE l.enrollment_id = e.id
                    AND l.billing_cycle = e.billing_cycle
                )
                ELSE NULL
              END AS calendar_total_lessons,
              CASE
                WHEN e.billing_type = 'monthly' THEN to_char(e.enrollment_start_date::date, 'YYYY-MM-DD')
                ELSE COALESCE(
                  (SELECT to_char((MIN(l.lesson_date) AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD')
                   FROM lessons l
                   WHERE l.enrollment_id = e.id AND l.billing_cycle = e.billing_cycle),
                  to_char(e.enrollment_start_date::date, 'YYYY-MM-DD')
                )
              END AS first_lesson_date,
              e.status AS enrollment_status, e.referral_notes,
              e.instructor_id, iu.full_name AS instructor_name,
              rs.name AS referral_source,
              ROUND(AVG(a.session_score)) AS avg_score`;

    const joins = `FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       LEFT JOIN users pu ON pu.id = sp.parent_id
       LEFT JOIN enrollments e ON e.student_id = u.id
       LEFT JOIN users iu ON iu.id = e.instructor_id
       LEFT JOIN instructor_subjects ist ON ist.id = e.subject_id
       LEFT JOIN instructor_groups ig ON ig.id = e.group_id
       LEFT JOIN referral_sources rs ON rs.id = e.referral_source_id
       LEFT JOIN attendance a ON a.enrollment_id = e.id AND a.attended = TRUE`;

    const group = `GROUP BY u.id, u.full_name, u.email, u.phone, sp.parent_id, sp.grade,
                sp.monthly_fee,
                sp.parent_name, sp.parent_phone, pu.full_name, pu.phone,
                e.id, e.billing_type, e.lesson_count, e.billing_cycle, e.lesson_weekdays, e.lesson_times, e.enrollment_start_date, e.billing_timing, e.payment_plan, e.status,
                e.referral_notes, e.instructor_id, e.subject_id, e.group_id, ist.name, ig.name, iu.full_name, rs.name
       ORDER BY u.full_name`;

    if (!isAdmin) {
      if (!instructorId) {
        return res.status(400).json({ success: false, message: 'İstifadəçi identifikatoru yoxdur' });
      }
      const { rows } = await db.query(
        `${select}
         ${joins}
         WHERE u.role = 'student' AND u.is_active = TRUE
           AND e.id IS NOT NULL
           AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1
         ${group}`,
        [instructorId]
      );
      return res.json({ success: true, students: rows });
    }

    const { rows } = await db.query(
      `${select}
       ${joins}
       WHERE u.role = 'student' AND u.is_active = TRUE
       ${group}`
    );
    res.json({ success: true, students: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getStudent = async (req, res) => {
  try {
    if (req.user.role === 'student' && String(req.params.id) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const { rows } = await db.query(
      `SELECT u.*, sp.parent_id, sp.grade, sp.notes,
              sp.monthly_fee,
              pu.full_name AS parent_name, pu.phone AS parent_phone,
              e.id AS enrollment_id, e.billing_type, e.lesson_count,
              e.lesson_weekdays, e.lesson_times, e.billing_cycle,
              e.enrollment_start_date,
              e.billing_timing,
              COALESCE(e.payment_plan, 'full') AS payment_plan,
              e.subject_id, e.group_id,
              subj.name AS track_subject_name,
              grp.name AS track_group_name,
              e.status AS enrollment_status, e.enrolled_at AS enrollment_started_at,
              iu.full_name AS instructor_name,
              COALESCE(NULLIF(TRIM(iprof.public_label), ''), 'instructor') AS instructor_public_label
       FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       LEFT JOIN users pu ON pu.id = sp.parent_id
       LEFT JOIN LATERAL (
         SELECT e2.* FROM enrollments e2
         WHERE e2.student_id = u.id
         ORDER BY e2.enrolled_at DESC NULLS LAST, e2.id DESC
         LIMIT 1
       ) e ON TRUE
       LEFT JOIN users iu ON iu.id = e.instructor_id
       LEFT JOIN instructor_subjects subj ON subj.id = e.subject_id
       LEFT JOIN instructor_groups grp ON grp.id = e.group_id
       LEFT JOIN instructor_profiles iprof ON iprof.user_id = e.instructor_id
       WHERE u.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    res.json({ success: true, student: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteStudent = async (req, res) => {
  try {
    const enrId = req.params.enrollmentId;
    const { rows: enr } = await db.query('SELECT id, student_id FROM enrollments WHERE id = $1', [enrId]);
    if (!enr[0]) return res.status(404).json({ success: false, message: 'Enrollment tapılmadı' });
    const studentId = enr[0].student_id;

    await db.transaction(async (client) => {
      // Safety: even if hard delete fails due to unexpected FK, disable login and free unique phone/email immediately
      await client.query(
        `UPDATE users
         SET is_active = FALSE,
             phone = NULL,
             email = NULL,
             phone_verified = FALSE,
             deleted_at = NOW()
         WHERE id = $1`,
        [studentId]
      );

      // Domain rule: tələbə silinirsə, hesab da silinsin (yenidən eyni nömrə ilə qeydiyyat mümkün olsun)
      // 1) tələbəyə bağlı bütün enrollment-ları tap
      const { rows: enrRows } = await client.query(
        'SELECT id FROM enrollments WHERE student_id = $1',
        [studentId]
      );
      const enrollmentIds = enrRows.map((r) => r.id).filter(Boolean);

      // 2) schedule slotları boşalt (bütün enrollment-lar üçün)
      if (enrollmentIds.length) {
        await client.query(
          `UPDATE teacher_schedules
           SET is_occupied = FALSE, student_id = NULL, enrollment_id = NULL
           WHERE enrollment_id = ANY($1::uuid[])`,
          [enrollmentIds]
        );
      }

      // 3) enrollment-a bağlı cədvəllər
      if (enrollmentIds.length) {
        // Keep audit/analytics: soft-delete core rows.
        await client.query(
          `UPDATE payments SET deleted_at = NOW()
           WHERE enrollment_id = ANY($1::uuid[])`,
          [enrollmentIds]
        );
        await client.query(
          `UPDATE lessons SET deleted_at = NOW()
           WHERE enrollment_id = ANY($1::uuid[])`,
          [enrollmentIds]
        ).catch(() => {});
        await client.query(
          `UPDATE enrollments
           SET status = 'deleted',
               deleted_at = NOW()
           WHERE id = ANY($1::uuid[])`,
          [enrollmentIds]
        );

        // Non-core helper tables can be cleared safely.
        await client.query('DELETE FROM attendance WHERE enrollment_id = ANY($1::uuid[])', [enrollmentIds]).catch(() => {});
        await client.query('DELETE FROM enrollment_lessons WHERE enrollment_id = ANY($1::uuid[])', [enrollmentIds]).catch(() => {});
      }

      // 4) user-a bağlı cədvəllər (FK-ları təmizlə)
      // Keep payments/lessons for audit: already soft-deleted above by enrollment_id, but do it again just in case.
      await client.query('UPDATE payments SET deleted_at = NOW() WHERE student_id = $1', [studentId]).catch(() => {});
      await client.query('UPDATE lessons SET deleted_at = NOW() WHERE student_id = $1', [studentId]).catch(() => {});

      await client.query('DELETE FROM exam_results WHERE student_id = $1', [studentId]).catch(() => {});
      await client.query('DELETE FROM exam_assignments WHERE student_id = $1', [studentId]).catch(() => {});
      await client.query('DELETE FROM notifications WHERE user_id = $1', [studentId]).catch(() => {});
      await client.query('DELETE FROM student_assignments WHERE student_id = $1', [studentId]).catch(() => {});
      await client.query('DELETE FROM student_prep_slots WHERE student_id = $1', [studentId]).catch(() => {});

      // 5) profil + user
      await client.query('DELETE FROM student_profiles WHERE user_id = $1', [studentId]).catch(() => {});
      // users row is kept (soft deleted above)
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

function parseDay(v) {
  const d = parseInt(String(v), 10);
  if (!Number.isFinite(d) || d < 1 || d > 7) return null;
  return d;
}

/** HH:MM və ya HH:MM:SS */
function parseTime(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const sec = m[3] != null ? parseInt(m[3], 10) : 0;
  if (h < 0 || h > 23 || min < 0 || min > 59 || sec < 0 || sec > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function toMinutes(t) {
  const [h, m] = t.split(':').map((x) => parseInt(x, 10));
  return h * 60 + m;
}

/** ISO həftə günü: Bazar=7, B.e.=1 (UTC təqvim günü ilə) */
function isoDowMon1FromUtcDate(d) {
  if (!d) return null;
  const w = d.getUTCDay();
  return w === 0 ? 7 : w;
}

function padHHMM(t) {
  const m = String(t || '').trim().match(/^(\d{1,2}):(\d{2})$/);
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

function nextYmdOnOrAfterWeekday(startYmd, weekday) {
  if (!startYmd || !weekday || weekday < 1 || weekday > 7) return null;
  const start = parseYmdUtcNoon(startYmd);
  if (!start) return null;
  for (let i = 0; i < 370; i += 1) {
    const d = new Date(start.getTime() + i * 86400000);
    if (isoDowMon1FromUtcDate(d) === weekday) return ymdFromUtcDate(d);
  }
  return null;
}

function bakuInstantIsoFromYmdAndHm(ymd, hhmm) {
  const hm = padHHMM(hhmm);
  if (!hm || !ymd) return null;
  const [H, M] = hm.split(':').map((x) => parseInt(x, 10));
  return `${ymd}T${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}:00+04:00`;
}

function overlapsTimeRange(aStart, aEnd, bStart, bEnd) {
  const as = toMinutes(aStart);
  const ae = toMinutes(aEnd);
  const bs = toMinutes(bStart);
  const be = toMinutes(bEnd);
  if (![as, ae, bs, be].every(Number.isFinite)) return false;
  return as < be && bs < ae;
}

function weekdayAz(weekday) {
  const m = { 1: 'B.e.', 2: 'Ç.a.', 3: 'Çər.', 4: 'C.a.', 5: 'Cümə', 6: 'Şən.', 7: 'Baz.' };
  return m[weekday] || String(weekday);
}

function add60MinEnd(hhmm) {
  const s = padHHMM(hhmm);
  if (!s) return null;
  const mins = toMinutes(s);
  if (!Number.isFinite(mins)) return null;
  const endMin = mins + 60;
  const eh = String(Math.floor(endMin / 60) % 24).padStart(2, '0');
  const em = String(endMin % 60).padStart(2, '0');
  return `${eh}:${em}`;
}

/** Tələbə profili: həftəlik dərs günləri + slot məlumatı (boş günləri UI çıxarır) */
/** Müəllim: paket üçün lessons; aylıq üçün lesson_times + həftə günlərindən növbəti təqvim nöqtələri (lessons olmadan da cədvəl dolur). */
const getInstructorMyLessonsCalendar = async (req, res) => {
  try {
    const iid =
      req.user.id != null ? String(req.user.id).trim().toLowerCase().replace(/-/g, '') : '';
    if (!iid) {
      return res.status(400).json({ success: false, message: 'İstifadəçi identifikatoru yoxdur' });
    }
    const { rows: lessons } = await db.query(
      `SELECT l.id, l.lesson_date, l.status, l.lesson_number, l.billing_cycle,
              u.full_name AS student_name,
              e.lesson_times AS enrollment_lesson_times
       FROM lessons l
       JOIN users u ON u.id = l.student_id
       JOIN enrollments e ON e.id = l.enrollment_id
       WHERE REPLACE(LOWER(TRIM(l.instructor_id::text)), '-', '') = $1
         AND u.is_active = TRUE
       ORDER BY l.lesson_date ASC`,
      [iid]
    );

    const today = await bakuTodayYmd();
    const { rows: monthlyRows } = await db.query(
      `SELECT e.id AS enrollment_id, e.lesson_weekdays, e.lesson_times,
              e.enrollment_start_date,
              u.full_name AS student_name
       FROM enrollments e
       JOIN users u ON u.id = e.student_id
       WHERE REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1
         AND e.billing_type = 'monthly'
         AND u.is_active = TRUE
         AND (e.status IS NULL OR LOWER(TRIM(e.status)) = 'active')`,
      [iid]
    );

    const synthetic = [];
    for (const row of monthlyRows) {
      let lt = row.lesson_times;
      if (lt != null && typeof lt === 'string') {
        try {
          lt = JSON.parse(lt);
        } catch {
          lt = {};
        }
      }
      if (!lt || typeof lt !== 'object') lt = {};

      const wdays = parseLessonWeekdaysJson(row.lesson_weekdays);
      const anchorRaw = row.enrollment_start_date;
      const anchorYmd = anchorRaw ? String(anchorRaw).slice(0, 10) : null;
      const anchorOk = anchorYmd && /^\d{4}-\d{2}-\d{2}$/.test(anchorYmd) ? anchorYmd : null;
      let startBase = today;
      if (anchorOk && anchorOk > startBase) startBase = anchorOk;

      for (const wd of wdays) {
        const hm = timeOnWeekday(lt, wd);
        if (!hm) continue;
        const ymd = nextYmdOnOrAfterWeekday(startBase, wd);
        if (!ymd) continue;
        const lessonDateIso = bakuInstantIsoFromYmdAndHm(ymd, hm);
        if (!lessonDateIso) continue;
        synthetic.push({
          id: `m:${row.enrollment_id}:${wd}`,
          lesson_date: lessonDateIso,
          status: 'monthly_grid',
          lesson_number: null,
          billing_cycle: null,
          student_name: row.student_name,
          enrollment_lesson_times: row.lesson_times,
        });
      }
    }

    const merged = [...lessons, ...synthetic].sort((a, b) =>
      String(a.lesson_date).localeCompare(String(b.lesson_date))
    );
    res.json({ success: true, lessons: merged });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getMySchedule = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { rows: prepSlots } = await db.query(
      `SELECT id, day_of_week, start_time, end_time, created_at
       FROM student_prep_slots
       WHERE student_id = $1
       ORDER BY day_of_week, start_time`,
      [studentId]
    );
    const { rows: lessons } = await db.query(
      `SELECT l.id, l.enrollment_id, l.instructor_id, iu.full_name AS instructor_name,
              l.lesson_date, l.status, l.lesson_number, l.billing_cycle,
              e.lesson_times AS enrollment_lesson_times
       FROM lessons l
       JOIN users iu ON iu.id = l.instructor_id
       JOIN enrollments e ON e.id = l.enrollment_id
       WHERE l.student_id = $1
       ORDER BY l.lesson_date ASC`,
      [studentId]
    );
    res.json({ success: true, lessons, prepSlots });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const addMyPrepSlots = async (req, res) => {
  try {
    const studentId = req.user.id;
    const days = Array.isArray(req.body.days) ? req.body.days : [];
    const start = parseTime(req.body.start_time);
    const end = parseTime(req.body.end_time);
    if (!start || !end || toMinutes(start) >= toMinutes(end)) {
      return res.status(400).json({ success: false, message: 'Saat aralığı yanlışdır' });
    }
    const uniq = [...new Set(days.map(parseDay).filter(Boolean))].sort((a, b) => a - b);
    if (!uniq.length) {
      return res.status(400).json({ success: false, message: 'Ən azı bir gün seçin' });
    }

    // 1) Prep slot overlaps with existing prep slots?
    const { rows: prepConflicts } = await db.query(
      `SELECT day_of_week, start_time, end_time
       FROM student_prep_slots
       WHERE student_id = $1
         AND day_of_week = ANY($2::int[])
         AND NOT (end_time <= $3::time OR start_time >= $4::time)
       LIMIT 1`,
      [studentId, uniq, start, end]
    );
    if (prepConflicts.length) {
      const c = prepConflicts[0];
      return res.status(400).json({
        success: false,
        message: `Toqquşma: ${weekdayAz(Number(c.day_of_week))} ${String(c.start_time).slice(0, 5)}–${String(c.end_time).slice(0, 5)} aralığında artıq hazırlıq slotu var.`,
      });
    }

    // 2) Prep slot overlaps with active weekly lesson time(s) on that weekday?
    // NOTE: allow creating prep slots on lesson weekdays, but never during the lesson time.
    const { rows: enrollments } = await db.query(
      `SELECT lesson_weekdays, lesson_times
       FROM enrollments
       WHERE student_id = $1
         AND (status IS NULL OR LOWER(TRIM(status)) = 'active')
       ORDER BY enrolled_at DESC NULLS LAST, id DESC`,
      [studentId]
    );
    for (const en of enrollments) {
      const wdays = parseLessonWeekdaysJson(en?.lesson_weekdays);
      let lt = en?.lesson_times;
      if (typeof lt === 'string') {
        try {
          lt = JSON.parse(lt);
        } catch {
          lt = {};
        }
      }
      if (!lt || typeof lt !== 'object') lt = {};

      for (const d of uniq) {
        if (!wdays.includes(d)) continue;
        const lessonStart = timeOnWeekday(lt, d);
        if (!lessonStart) continue;
        const lessonEnd = add60MinEnd(lessonStart);
        if (!lessonEnd) continue;
        if (overlapsTimeRange(start, end, lessonStart, lessonEnd)) {
          return res.status(400).json({
            success: false,
            message: `Toqquşma: ${weekdayAz(d)} günü ${lessonStart}–${lessonEnd} dərs saatı ilə üst-üstə düşür. Digər saat seçin.`,
          });
        }
      }
    }

    // 3) Extra safety: also check against actual scheduled lessons (in case weekly pattern is missing/old).
    // We compare by weekday/time-of-day in Asia/Baku; assumes default 60-minute lesson blocks.
    const { rows: lessonConflicts } = await db.query(
      `SELECT
         EXTRACT(ISODOW FROM (l.lesson_date AT TIME ZONE 'Asia/Baku'))::int AS dow,
         to_char((l.lesson_date AT TIME ZONE 'Asia/Baku')::time, 'HH24:MI') AS start_hm
       FROM lessons l
       WHERE l.student_id = $1
         AND EXTRACT(ISODOW FROM (l.lesson_date AT TIME ZONE 'Asia/Baku'))::int = ANY($2::int[])
         AND NOT (((l.lesson_date AT TIME ZONE 'Asia/Baku')::time + INTERVAL '60 minutes')::time <= $3::time
               OR (l.lesson_date AT TIME ZONE 'Asia/Baku')::time >= $4::time)
       ORDER BY l.lesson_date DESC
       LIMIT 1`,
      [studentId, uniq, start, end]
    );
    if (lessonConflicts.length) {
      const c = lessonConflicts[0];
      const lessonStart = String(c.start_hm || '').slice(0, 5);
      const lessonEnd = add60MinEnd(lessonStart) || '';
      return res.status(400).json({
        success: false,
        message: `Toqquşma: ${weekdayAz(Number(c.dow))} günü ${lessonStart}${lessonEnd ? `–${lessonEnd}` : ''} dərs saatı ilə üst-üstə düşür. Digər saat seçin.`,
      });
    }

    const { rows } = await db.query(
      `INSERT INTO student_prep_slots (student_id, day_of_week, start_time, end_time)
       SELECT $1::uuid, d::smallint, $2::time, $3::time
       FROM UNNEST($4::int[]) AS d
       RETURNING id, day_of_week, start_time, end_time, created_at`,
      [studentId, start, end, uniq]
    );
    res.status(201)