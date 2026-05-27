const router = require('express').Router();
const {
  listStudents,
  getReferralBreakdown,
  getStudent,
  deleteStudent,
  getMySchedule,
  getInstructorMyLessonsCalendar,
  addMyPrepSlots,
  deleteMyPrepSlot,
} = require('../controllers/studentController');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../utils/db');
const { patchStudentEmail } = require('../controllers/studentEmailController');
const { deliverPermanentPinSms } = require('../controllers/authController');
const { requireInstructorPhoneVerified } = require('../middleware/trial');
const { attachEntitlements, enforceStudentsLimit } = require('../middleware/entitlements');

function gateInstructorEnrollment(req, res, next) {
  if (req.user?.role === 'admin') return next();
  return requireInstructorPhoneVerified(req, res, next);
}

function normalizePhoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function sameUuid(a, b) {
  if (a == null || b == null) return false;
  return String(a).replace(/-/g, '').toLowerCase() === String(b).replace(/-/g, '').toLowerCase();
}

function normUuid(id) {
  return String(id).trim().toLowerCase().replace(/-/g, '');
}

function looksTrackUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s || '').trim());
}

/** Sahə/qrup FK-ləri yalnız həmin müəllimə aid sətirlərə bağlansın */
async function resolveEnrollmentTrack(dbConn, instructorId, subjectIdRaw, groupIdRaw) {
  const ni = normUuid(instructorId);
  const sidOk = looksTrackUuid(subjectIdRaw);
  const gidOk = looksTrackUuid(groupIdRaw);
  if (!sidOk && !gidOk) return { subject_id: null, group_id: null };

  if (gidOk) {
    const { rows } = await dbConn.query(
      `SELECT id, subject_id FROM instructor_groups
       WHERE id = $1 AND REPLACE(LOWER(TRIM(instructor_id::text)), '-', '') = $2`,
      [groupIdRaw, ni]
    );
    if (!rows[0]) {
      const err = new Error('Qrup tapılmadı və ya sizə aid deyil');
      err.statusCode = 400;
      throw err;
    }
    const subjectFromGroup = rows[0].subject_id;
    if (sidOk && normUuid(String(subjectIdRaw)) !== normUuid(String(subjectFromGroup))) {
      const err = new Error('Qrup seçilmiş sahəyə uyğun deyil');
      err.statusCode = 400;
      throw err;
    }
    return { subject_id: subjectFromGroup, group_id: rows[0].id };
  }

  if (sidOk) {
    const { rows } = await dbConn.query(
      `SELECT id FROM instructor_subjects
       WHERE id = $1 AND REPLACE(LOWER(TRIM(instructor_id::text)), '-', '') = $2`,
      [subjectIdRaw, ni]
    );
    if (!rows[0]) {
      const err = new Error('Sahə tapılmadı və ya sizə aid deyil');
      err.statusCode = 400;
      throw err;
    }
    return { subject_id: rows[0].id, group_id: null };
  }
  return { subject_id: null, group_id: null };
}

function parseMonthlyFee(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function parsePaymentStartDate(v) {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, mo, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return s;
}

/** Qeydiyyat: postpaid / prepaid (8/12/aylıq üçün eyni sahələr) */
function parseBillingTiming(v) {
  if (String(v || '').trim().toLowerCase() === 'prepaid') return 'prepaid';
  return 'postpaid';
}

function parsePaymentPlan(v) {
  return String(v || '').trim().toLowerCase() === 'partial' ? 'partial' : 'full';
}

function parseNotificationsEnabled(v) {
  if (v === undefined || v === null || v === '') return true;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
  return Boolean(v);
}

/** 1–7 unikal, sıralı (B.e. … Bazar) */
function parseLessonWeekdays(raw) {
  if (raw == null) return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
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

function parseLessonTimes(raw, lessonWeekdays) {
  if (raw == null) return {};
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
  const days = Array.isArray(lessonWeekdays) ? lessonWeekdays : [];
  for (const d of days) {
    const v = obj[d] ?? obj[String(d)];
    if (v == null || v === '') continue;
    const s = String(v).trim();
    if (!/^\d{1,2}:\d{2}$/.test(s)) continue;
    const [h, m] = s.split(':').map(Number);
    if (h < 0 || h > 23 || m < 0 || m > 59) continue;
    out[String(d)] = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return out;
}

function billingLimit(type) {
  if (type === '8_lessons') return 8;
  if (type === '12_lessons') return 12;
  return null;
}

function weekdayFromYmd(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(String(ymd))) return null;
  const [y, mo, d] = String(ymd).split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return ((dt.getUTCDay() + 6) % 7) + 1; // Mon=1..Sun=7
}

function nextDateForWeekday(afterYmd, weekday /*1-7*/, ymdInclusive) {
  // use UTC dates to avoid TZ drift; store as YYYY-MM-DD
  const [y, mo, d] = afterYmd.split('-').map(Number);
  const base = new Date(Date.UTC(y, mo - 1, d));
  const baseDow = ((base.getUTCDay() + 6) % 7) + 1; // Mon=1..Sun=7
  let delta = (weekday - baseDow + 7) % 7;
  if (delta === 0 && !ymdInclusive) delta = 7;
  const dt = new Date(base.getTime() + delta * 86400000);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

async function bakuTodayYmdDb(dbConn) {
  const { rows } = await dbConn.query(
    `SELECT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS ymd`
  );
  return rows[0]?.ymd || new Date().toISOString().slice(0, 10);
}

function maxYmd(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

async function reserveGroupSlots(client, { instructor_id, ni, lwd, lt, subject_id, group_id }) {
  // If no group, don't reserve group lock slots.
  if (!group_id) return;
  for (const wd of lwd) {
    const t = lt?.[String(wd)];
    if (!t) continue;
    const start = `${String(t).slice(0, 5)}:00`;

    // If a slot exists and is occupied by another group, block.
    const { rows: slotRows } = await client.query(
      `SELECT id, is_occupied, group_id
       FROM teacher_schedules
       WHERE REPLACE(LOWER(TRIM(instructor_id::text)), '-', '') = $1
         AND day_of_week = $2
         AND start_time = $3::time
       LIMIT 1`,
      [ni, wd, start]
    );

    if (!slotRows[0]) continue; // no weekly slot configured -> skip lock
    const slot = slotRows[0];
    if (slot.is_occupied && slot.group_id && normUuid(slot.group_id) !== normUuid(group_id)) {
      throw Object.assign(new Error('LESSON_CONFLICT'), {
        code: 'LESSON_CONFLICT',
        kind: 'occupied_other_group',
        at: `${wd} ${String(t).slice(0, 5)}`,
      });
    }

    await client.query(
      `UPDATE teacher_schedules
       SET is_occupied = TRUE,
           subject_id = $2::uuid,
           group_id = $3::uuid
       WHERE id = $1::uuid`,
      [slot.id, subject_id || null, group_id]
    );
  }
}

function generateLessonStarts({ startYmd, lessonWeekdays, lessonTimes, count }) {
  // include startYmd: the first lesson can be on this exact date
  let cursor = startYmd;
  const out = [];
  for (let i = 0; i < count; i++) {
    let best = null;
    for (const wd of lessonWeekdays) {
      const t = lessonTimes[String(wd)];
      if (!t) continue;
      const nextYmd = nextDateForWeekday(cursor, wd, true);
      const ts = `${nextYmd} ${t}:00`;
      if (!best || ts < best) best = ts;
    }
    if (!best) break;
    out.push(best);
    // next search strictly after this lesson date
    cursor = best.slice(0, 10);
    // move cursor forward one day to avoid repeating same day when multiple weekdays include it
    const [yy, mm, dd] = cursor.split('-').map(Number);
    const dt = new Date(Date.UTC(yy, mm - 1, dd));
    const next = new Date(dt.getTime() + 86400000);
    cursor = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(
      next.getUTCDate()
    ).padStart(2, '0')}`;
  }
  return out;
}

/** 8/12: 1-ci dövrün planlı dərslərini silib yenidən yaradır (client = tranzaksiya client-i) */
async function replaceCycleOneScheduledLessons(client, params) {
  const { enrollmentId, studentId, instructor_id, ni, lwd, lt, firstYmd, limit, group_id } = params;
  if (!limit || !firstYmd) return;
  const todayBaku = await bakuTodayYmdDb(client);
  const starts = generateLessonStarts({
    startYmd: firstYmd,
    lessonWeekdays: lwd,
    lessonTimes: lt,
    count: limit,
  });
  if (starts.length < limit) {
    const err = new Error('Seçilmiş tarix və dərs günləri/saatları ilə kifayət qədər dərs yaradılmır');
    err.statusCode = 400;
    throw err;
  }
  for (let i = 0; i < starts.length; i++) {
    const ymd = starts[i].slice(0, 10);
    if (ymd < todayBaku) continue;
    const time = starts[i].slice(11, 16);
    const w = weekdayFromYmd(ymd);
    const occupied = await client.query(
      `SELECT id, group_id FROM teacher_schedules
       WHERE REPLACE(LOWER(TRIM(instructor_id::text)), '-', '') = $1
         AND is_occupied = TRUE
         AND day_of_week = $2
         AND start_time = $3::time
       LIMIT 1`,
      [ni, w, time]
    );
    if (occupied.rowCount > 0) {
      const otherGroup = occupied.rows[0]?.group_id || null;
      if (group_id && otherGroup && normUuid(otherGroup) === normUuid(group_id)) {
        // occupied by the same group -> allow
      } else {
        throw Object.assign(new Error(`Toqquşma: ${ymd} ${time} — həmin saat artıq tutulub. Digər saat seçin.`), {
          code: 'LESSON_CONFLICT',
          kind: 'occupied',
          at: `${ymd} ${time}`,
        });
      }
    }
    const exists = await client.query(
      `SELECT l.id,
              u.full_name AS student_name,
              ist.name AS subject_name,
              ig.name AS group_name
       FROM lessons l
       JOIN enrollments e2 ON e2.id = l.enrollment_id
       LEFT JOIN users u ON u.id = l.student_id
       LEFT JOIN instructor_subjects ist ON ist.id = e2.subject_id
       LEFT JOIN instructor_groups ig ON ig.id = e2.group_id
       WHERE l.instructor_id = $1
         AND l.student_id <> $3
         AND to_char((l.lesson_date AT TIME ZONE 'Asia/Baku'), 'YYYY-MM-DD HH24:MI') = $2
         AND NOT (l.enrollment_id = $4::uuid AND l.billing_cycle = 1)
         AND (
           $5::uuid IS NULL
           OR e2.group_id IS DISTINCT FROM $5::uuid
         )
       LIMIT 1`,
      [instructor_id, `${ymd} ${time}`, studentId, enrollmentId, group_id || null]
    );
    if (exists.rowCount > 0) {
      const r = exists.rows[0] || {};
      const who = String(r.student_name || '').trim();
      const subj = String(r.subject_name || '').trim();
      const grp = String(r.group_name || '').trim();
      const withLabel = [subj, grp].filter(Boolean).join(' — ');
      throw Object.assign(
        new Error(
          `Toqquşma: ${ymd} ${time} — həmin saatda başqa dərs var (${who || 'Tələbə'}${withLabel ? ` — ${withLabel}` : ''}). Digər saat seçin.`
        ),
        {
        code: 'LESSON_CONFLICT',
        kind: 'existing_lesson',
        at: `${ymd} ${time}`,
        conflict_with: `${who || 'Tələbə'}${withLabel ? ` (${withLabel})` : ''}`,
        }
      );
    }
  }

  await client.query(`DELETE FROM attendance WHERE enrollment_id = $1 AND billing_cycle = 1`, [enrollmentId]);
  await client.query(`UPDATE enrollments SET lesson_count = 0 WHERE id = $1`, [enrollmentId]);
  await client.query(`DELETE FROM lessons WHERE enrollment_id = $1 AND billing_cycle = 1`, [enrollmentId]);
  await client.query(`DELETE FROM enrollment_lessons WHERE enrollment_id = $1 AND billing_cycle = 1`, [enrollmentId]);

  for (let i = 0; i < starts.length; i++) {
    await client.query(
      `INSERT INTO enrollment_lessons (enrollment_id, billing_cycle, lesson_number, starts_at)
       VALUES ($1, 1, $2, $3::timestamp)
       ON CONFLICT (enrollment_id, billing_cycle, lesson_number) DO NOTHING`,
      [enrollmentId, i + 1, starts[i]]
    );
    await client.query(
      `INSERT INTO lessons (enrollment_id, student_id, instructor_id, lesson_date, status, lesson_number, billing_cycle)
       VALUES ($1,$2,$3,($4::timestamp AT TIME ZONE 'Asia/Baku'),'pending',$5,1)
       ON CONFLICT (enrollment_id, billing_cycle, lesson_number) DO NOTHING`,
      [enrollmentId, student_id, instructor_id, starts[i], i + 1]
    );
  }
}

router.get('/referral-breakdown', authenticate, authorize('admin', 'instructor'), getReferralBreakdown);
router.get('/', authenticate, authorize('admin', 'instructor'), listStudents);

router.delete('/enrollment/:enrollmentId', authenticate, authorize('admin', 'instructor'), deleteStudent);

router.post(
  '/enroll',
  authenticate,
  authorize('instructor', 'admin'),
  gateInstructorEnrollment,
  attachEntitlements,
  enforceStudentsLimit,
  async (req, res) => {
  try {
    const {
      student_id,
      billing_type,
      referral_notes,
      referral_source_id,
      parent_name,
      parent_phone,
      monthly_fee,
      enrollment_date,
      billing_timing,
      payment_plan,
      first_lesson_date,
      teacher_schedule_id,
      lesson_weekdays,
      lesson_times,
      subject_id,
      group_id,
      course_id,
    } = req.body;
    const instructor_id = req.user.role === 'admin' ? req.body.instructor_id : req.user.id;
    const ni = normUuid(instructor_id);

    const lwd = parseLessonWeekdays(lesson_weekdays);
    if (lwd.length === 0) {
      return res.status(400).json({ success: false, message: 'Ən azı bir dərs günü seçin' });
    }
    const lt = parseLessonTimes(lesson_times, lwd);
    if (Object.keys(lt).length === 0) {
      return res.status(400).json({ success: false, message: 'Dərs günlərinə uyğun saatları qeyd edin' });
    }

    const enrollmentYmd = parsePaymentStartDate(enrollment_date);
    if (!enrollmentYmd) {
      return res.status(400).json({ success: false, message: 'Dərslərə başlama tarixi seçilməlidir' });
    }

    const limitForValidation = billingLimit(billing_type || '8_lessons');
    if (!limitForValidation) {
      return res.status(400).json({ success: false, message: 'Billing növü yalnız 8 və ya 12 dərs ola bilər' });
    }
    const firstYmd = parsePaymentStartDate(first_lesson_date);
    if (!firstYmd) {
      return res.status(400).json({ success: false, message: 'İlk dərs tarixi seçilməlidir' });
    }
    if (firstYmd && firstYmd < enrollmentYmd) {
      return res.status(400).json({
        success: false,
        message: 'İlk dərs tarixi, dərslərə başlama tarixindən əvvəl ola bilməz',
      });
    }
    if (firstYmd) {
      const wd = weekdayFromYmd(firstYmd);
      if (!wd || !lwd.includes(wd) || !lt[String(wd)]) {
        return res.status(400).json({
          success: false,
          message: 'İlk dərs tarixi seçdiyiniz dərs günləri/saatları ilə uyğun deyil',
        });
      }
    }

    const { rows: cnt } = await db.query(
      `SELECT COUNT(*)::int AS n FROM teacher_schedules
       WHERE REPLACE(LOWER(TRIM(instructor_id::text)), '-', '') = $1`,
      [ni]
    );
    // artıq tələb olunmur: dərs vaxtı həftəlik gün/saat + ilk dərs tarixi ilə generasiya olunur

    const mf = parseMonthlyFee(monthly_fee);
    const bt = parseBillingTiming(billing_timing);
    const payPlan = parsePaymentPlan(payment_plan);
    const notifEnabled = parseNotificationsEnabled(req.body?.notifications_enabled);

    let trackIds = { subject_id: null, group_id: null };
    try {
      trackIds = await resolveEnrollmentTrack(db, instructor_id, subject_id, group_id);
    } catch (e) {
      return res.status(e.statusCode || 400).json({ success: false, message: e.message });
    }

    const enrollment = await db.transaction(async (client) => {
      const todayBaku = await bakuTodayYmdDb(client);
      const { rows } = await client.query(
        `INSERT INTO enrollments (
           instructor_id, student_id, billing_type, referral_notes, referral_source_id,
           lesson_weekdays, lesson_times, enrollment_start_date,
           billing_timing, payment_plan, subject_id, group_id,
           notifications_enabled, course_id
         )
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::date,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [
          instructor_id,
          student_id,
          billing_type || '8_lessons',
          referral_notes,
          referral_source_id || null,
          JSON.stringify(lwd),
          JSON.stringify(lt),
          enrollmentYmd,
          bt,
          payPlan,
          trackIds.subject_id,
          trackIds.group_id,
          notifEnabled,
          course_id || null,
        ]
      );
      const enr = rows[0];

      // Group-lock weekly slots so only same subject/group can use them
      await reserveGroupSlots(client, {
        instructor_id,
        ni,
        lwd,
        lt,
        subject_id: trackIds.subject_id,
        group_id: trackIds.group_id,
      });

      // teacher_schedules ilə bağlama artıq istifadə olunmur (dərslər dated lessons kimi saxlanır)

      const pn = parent_name != null ? String(parent_name).trim() : '';
      const pp = parent_phone != null ? String(parent_phone).trim() : '';
      const pr = await client.query(
        `UPDATE student_profiles SET
          parent_name = COALESCE(NULLIF($1, ''), parent_name),
          parent_phone = COALESCE(NULLIF($2, ''), parent_phone),
          monthly_fee = $3
         WHERE user_id = $4`,
        [pn, pp, mf, student_id]
      );
      if (pr.rowCount === 0) {
        await client.query(
          `INSERT INTO student_profiles (user_id, parent_name, parent_phone, monthly_fee)
           VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), $4)`,
          [student_id, pn, pp, mf]
        );
      }

      // generate enrollment_lessons for first billing cycle (8/12).
      const limit = billingLimit(enr.billing_type);
      const startYmd = firstYmd || enrollmentYmd;
      if (limit) {
        const starts = generateLessonStarts({
          startYmd,
          lessonWeekdays: lwd,
          lessonTimes: lt,
          count: limit,
        });

        // conflict check: existing lessons for instructor + occupied weekly slots
        for (let i = 0; i < starts.length; i++) {
          const ymd = starts[i].slice(0, 10);
          // Keçmiş tarixlər üçün conflict yoxlamırıq: tarixçə üçün dərsləri yazmağa icazə veririk
          if (ymd < todayBaku) continue;
          const time = starts[i].slice(11, 16);
          const w = weekdayFromYmd(ymd);
          const occupied = await client.query(
            `SELECT id, group_id FROM teacher_schedules
             WHERE REPLACE(LOWER(TRIM(instructor_id::text)), '-', '') = $1
               AND is_occupied = TRUE
               AND day_of_week = $2
               AND start_time = $3::time
             LIMIT 1`,
            [ni, w, time]
          );
          if (occupied.rowCount > 0) {
            const otherGroup = occupied.rows[0]?.group_id || null;
            if (trackIds.group_id && otherGroup && normUuid(otherGroup) === normUuid(trackIds.group_id)) {
              // occupied by the same group -> allow
            } else {
              throw Object.assign(
                new Error(`Toqquşma: ${ymd} ${time} — həmin saat artıq tutulub. Digər saat seçin.`),
                {
                  code: 'LESSON_CONFLICT',
                  kind: 'occupied',
                  at: `${ymd} ${time}`,
                }
              );
            }
          }

          const exists = await client.query(
            `SELECT l.id,
                    u.full_name AS student_name,
                    ist.name AS subject_name,
                    ig.name AS group_name
             FROM lessons l
             JOIN enrollments e2 ON e2.id = l.enrollment_id
             LEFT JOIN users u ON u.id = l.student_id
             LEFT JOIN instructor_subjects ist ON ist.id = e2.subject_id
             LEFT JOIN instructor_groups ig ON ig.id = e2.group_id
             WHERE l.instructor_id = $1
               AND l.student_id <> $3
               AND to_char((l.lesson_date AT TIME ZONE 'Asia/Baku'), 'YYYY-MM-DD HH24:MI') = $2
               AND (
                 $4::uuid IS NULL
                 OR e2.group_id IS DISTINCT FROM $4::uuid
               )
             LIMIT 1`,
            [instructor_id, `${ymd} ${time}`, student_id, trackIds.group_id || null]
          );
          if (exists.rowCount > 0) {
            const r = exists.rows[0] || {};
            const who = String(r.student_name || '').trim();
            const subj = String(r.subject_name || '').trim();
            const grp = String(r.group_name || '').trim();
            const withLabel = [subj, grp].filter(Boolean).join(' — ');
            throw Object.assign(
              new Error(
                `Toqquşma: ${ymd} ${time} — həmin saatda başqa dərs var (${who || 'Tələbə'}${withLabel ? ` — ${withLabel}` : ''}). Digər saat seçin.`
              ),
              {
                code: 'LESSON_CONFLICT',
                kind: 'existing_lesson',
                at: `${ymd} ${time}`,
                conflict_with: `${who || 'Tələbə'}${withLabel ? ` (${withLabel})` : ''}`,
              }
            );
          }
        }

        for (let i = 0; i < starts.length; i++) {
          await client.query(
            `INSERT INTO enrollment_lessons (enrollment_id, billing_cycle, lesson_number, starts_at)
             VALUES ($1, 1, $2, $3::timestamp)
             ON CONFLICT (enrollment_id, billing_cycle, lesson_number) DO NOTHING`,
            [enr.id, i + 1, starts[i]]
          );
          await client.query(
            `INSERT INTO lessons (enrollment_id, student_id, instructor_id, lesson_date, status, lesson_number, billing_cycle)
             VALUES ($1,$2,$3,($4::timestamp AT TIME ZONE 'Asia/Baku'),'pending',$5,1)
             ON CONFLICT (enrollment_id, billing_cycle, lesson_number) DO NOTHING`,
            [enr.id, student_id, instructor_id, starts[i], i + 1]
          );
        }
      }

      if (course_id) {
        await client.query(
          `INSERT INTO course_students (course_id, student_id, enrollment_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (course_id, student_id) DO UPDATE SET enrollment_id = EXCLUDED.enrollment_id`,
          [course_id, student_id, enr.id],
        );
      }

      if (req.user?.role === 'instructor') {
        const { rows: cntRows } = await client.query(
          `SELECT COUNT(DISTINCT u.id)::int AS n
           FROM enrollments e
           JOIN users u ON u.id = e.student_id
           WHERE e.instructor_id = $1
             AND e.deleted_at IS NULL
             AND COALESCE(NULLIF(LOWER(TRIM(e.status)), ''), 'active') = 'active'
             AND u.is_active = TRUE`,
          [instructor_id],
        )
        const n = Number(cntRows[0]?.n ?? 0) || 0
        await client.query(
          `INSERT INTO usage_counters (user_id, students_count)
           VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE SET students_count = $2, updated_at = NOW()`,
          [instructor_id, n],
        )
      }
      return enr;
    });

    let pin_sms = { attempted: false, sent: false, skipped: false, message: '' };
    try {
      const { rows: urows } = await db.query(
        `SELECT id, role, phone, pin_hash, is_verified
         FROM users
         WHERE id = $1 AND is_active = TRUE`,
        [student_id]
      );
      const u = urows[0];
      if (u && u.role === 'student') {
        if (u.is_verified === false) {
          pin_sms.attempted = true;
          pin_sms.skipped = true;
          pin_sms.message = 'E-poçt təsdiqi tələb olunur — PIN SMS göndərilmədi.';
          // Login yalnız email təsdiqindən sonra icazəlidir.
          // PIN SMS göndərmirik ki, SMS xərci azalsın.
          // (İstəsəniz təsdiqdən sonra PIN “Daxil ol” ilə göndərilə bilər.)
          return res.json({ success: true, enrollment, pin_sms });
        }
        const clean = normalizePhoneDigits(u.phone);
        pin_sms.attempted = true;
        if (!clean) {
          pin_sms.skipped = true;
          pin_sms.message = 'Telefon yoxdur — PIN SMS göndərilmədi.';
        } else {
          const r = await deliverPermanentPinSms(u, clean, { force: false });
          if (r.alreadyHadPin) {
            pin_sms.skipped = true;
            pin_sms.message = 'PIN artıq mövcuddur — əlavə SMS göndərilmədi.';
          } else if (r.pinSmsSent) {
            pin_sms.sent = true;
            pin_sms.message = 'Tələbənin nömrəsinə daimi 6 rəqəmli PIN SMS göndərildi.';
          }
        }
      }
    } catch (e) {
      pin_sms.attempted = true;
      pin_sms.sent = false;
      pin_sms.skipped = false;
      pin_sms.message = e?.body?.message || e?.message || 'PIN SMS göndərilə bilmədi';
      pin_sms.error = true;
    }

    res.json({ success: true, enrollment, pin_sms });
  } catch (err) {
    if (err.code === 'LESSON_CONFLICT') {
      const detail =
        err.kind === 'occupied'
          ? 'Müəllimin həmin gün/saatı “occupied” kimi bloklanıb.'
          : err.kind === 'existing_lesson'
            ? 'Müəllimin həmin gün/saatda başqa dərsi var.'
            : '';
      const withWho = err.conflict_with ? ` Toqquşma: ${err.conflict_with}.` : '';
      return res.status(409).json({
        success: false,
        message: `Dərs cədvəlində uyğun olmayan vaxt var: ${err.at || ''} ${detail}${withWho}`.trim(),
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// Telebe ve enrollment redakte et
router.patch('/enrollment/:enrollmentId', authenticate, authorize('admin', 'instructor'), async (req, res) => {
  try {
    const {
      full_name,
      phone,
      billing_type,
      referral_notes,
      parent_name,
      parent_phone,
      monthly_fee,
      enrollment_date,
      billing_timing,
      payment_plan,
      lesson_weekdays,
      lesson_times,
      subject_id,
      group_id,
      first_lesson_date,
    } = req.body;
    const { enrollmentId } = req.params;

    const { rows: enrRows } = await db.query(
      'SELECT student_id, instructor_id FROM enrollments WHERE id = $1',
      [enrollmentId]
    );
    if (!enrRows[0]) return res.status(404).json({ success: false, message: 'Enrollment tapilmadi' });
    const { student_id: studentId, instructor_id: enrollmentInstructorId } = enrRows[0];

    if (req.user.role === 'instructor' && !sameUuid(enrollmentInstructorId, req.user.id)) {
      return res.status(403).json({ success: false, message: 'Bu qeydiyyata icazəniz yoxdur' });
    }

    await db.query('UPDATE users SET full_name = $1, phone = $2 WHERE id = $3', [full_name, phone, studentId]);

    const hasLwd = Object.prototype.hasOwnProperty.call(req.body, 'lesson_weekdays');
    const hasLt = Object.prototype.hasOwnProperty.call(req.body, 'lesson_times');
    const { rows: curEnrRows } = await db.query(
      'SELECT lesson_weekdays, lesson_times FROM enrollments WHERE id = $1',
      [enrollmentId]
    );
    const curEnr = curEnrRows[0] || {};

    const lwd = hasLwd ? parseLessonWeekdays(lesson_weekdays) : parseLessonWeekdays(curEnr.lesson_weekdays);
    if ((hasLwd || hasLt) && lwd.length === 0) {
      return res.status(400).json({ success: false, message: 'Ən azı bir dərs günü seçin' });
    }
    const lt = hasLt
      ? parseLessonTimes(lesson_times, lwd)
      : parseLessonTimes(curEnr.lesson_times, lwd);
    if ((hasLwd || hasLt) && lwd.length > 0 && Object.keys(lt).length === 0) {
      return res.status(400).json({ success: false, message: 'Dərs günlərinə uyğun saatları qeyd edin' });
    }

    if (billing_type != null && billing_type !== '') {
      const lim = billingLimit(billing_type);
      if (!lim) {
        return res.status(400).json({ success: false, message: 'Billing növü yalnız 8 və ya 12 dərs ola bilər' });
      }
    }

    if (hasLwd || hasLt) {
      await db.query(
        `UPDATE enrollments
         SET billing_type = $1,
             referral_notes = $2,
             lesson_weekdays = $3::jsonb,
             lesson_times = $4::jsonb
         WHERE id = $5`,
        [billing_type, referral_notes || null, JSON.stringify(lwd), JSON.stringify(lt), enrollmentId]
      );
    } else {
      await db.query(
        'UPDATE enrollments SET billing_type = $1, referral_notes = $2 WHERE id = $3',
        [billing_type, referral_notes || null, enrollmentId]
      );
    }

    const pName = parent_name != null ? String(parent_name).trim() : '';
    const pPhone = parent_phone != null ? String(parent_phone).trim() : '';
    const hasMf = Object.prototype.hasOwnProperty.call(req.body, 'monthly_fee');
    const hasEnr = Object.prototype.hasOwnProperty.call(req.body, 'enrollment_date');
    const hasBt = Object.prototype.hasOwnProperty.call(req.body, 'billing_timing');
    const mf = hasMf ? parseMonthlyFee(monthly_fee) : null;
    const enrYmd = hasEnr ? parsePaymentStartDate(enrollment_date) : null;
    if (hasEnr && !enrYmd) {
      return res.status(400).json({ success: false, message: 'Dərslərə başlama tarixi düzgün deyil (YYYY-MM-DD)' });
    }
    const setParts = [`parent_name = NULLIF($1, '')`, `parent_phone = NULLIF($2, '')`];
    const vals = [pName, pPhone];
    let idx = 3;
    if (hasMf) {
      setParts.push(`monthly_fee = $${idx}::numeric`);
      vals.push(mf);
      idx += 1;
    }
    vals.push(studentId);
    const profUp = await db.query(
      `UPDATE student_profiles SET ${setParts.join(', ')} WHERE user_id = $${idx}`,
      vals
    );
    if (profUp.rowCount === 0) {
      await db.query(
        `INSERT INTO student_profiles (user_id, parent_name, parent_phone, monthly_fee)
         VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), $4)`,
        [studentId, pName, pPhone, hasMf ? mf : null]
      );
    }

    if (hasEnr && enrYmd) {
      await db.query('UPDATE enrollments SET enrollment_start_date = $1::date WHERE id = $2', [enrYmd, enrollmentId]);
    }

    if (hasBt) {
      await db.query(`UPDATE enrollments SET billing_timing = $1::text WHERE id = $2`, [
        parseBillingTiming(billing_timing),
        enrollmentId,
      ]);
    }

    const hasPp = Object.prototype.hasOwnProperty.call(req.body, 'payment_plan');
    if (hasPp) {
      await db.query(`UPDATE enrollments SET payment_plan = $1::text WHERE id = $2`, [
        parsePaymentPlan(payment_plan),
        enrollmentId,
      ]);
    }

    const hasNotif = Object.prototype.hasOwnProperty.call(req.body, 'notifications_enabled');
    if (hasNotif) {
      await db.query(`UPDATE enrollments SET notifications_enabled = $1::boolean WHERE id = $2`, [
        parseNotificationsEnabled(req.body.notifications_enabled),
        enrollmentId,
      ]);
    }

    const hasTrackSub = Object.prototype.hasOwnProperty.call(req.body, 'subject_id');
    const hasTrackGrp = Object.prototype.hasOwnProperty.call(req.body, 'group_id');
    if (hasTrackSub || hasTrackGrp) {
      const { rows: curTrack } = await db.query(
        'SELECT subject_id, group_id, instructor_id FROM enrollments WHERE id = $1',
        [enrollmentId]
      );
      const cur = curTrack[0] || {};
      const effSub = hasTrackSub ? (subject_id === '' || subject_id == null ? null : subject_id) : cur.subject_id;
      const effGrp = hasTrackGrp ? (group_id === '' || group_id == null ? null : group_id) : cur.group_id;
      try {
        const track = await resolveEnrollmentTrack(db, cur.instructor_id, effSub, effGrp);
        await db.query('UPDATE enrollments SET subject_id = $1, group_id = $2 WHERE id = $3', [
          track.subject_id,
          track.group_id,
          enrollmentId,
        ]);
      } catch (e) {
        return res.status(e.statusCode || 400).json({ success: false, message: e.message });
      }
    }

    const hasFirstLesson = Object.prototype.hasOwnProperty.call(req.body, 'first_lesson_date');
    if (hasFirstLesson) {
      const { rows: enFresh } = await db.query(
        `SELECT e.id, e.student_id, e.instructor_id, e.billing_type, e.billing_cycle, e.lesson_count,
                e.lesson_weekdays, e.lesson_times, e.enrollment_start_date
         FROM enrollments e WHERE e.id = $1`,
        [enrollmentId]
      );
      const ent = enFresh[0];
      if (!ent) {
        return res.status(404).json({ success: false, message: 'Enrollment tapılmadı' });
      }
      const lim = billingLimit(ent.billing_type);
      const flRaw = first_lesson_date;
      const wantsChange = flRaw != null && String(flRaw).trim() !== '';
      if (!lim) {
        if (wantsChange) {
          const anchorYmd = parsePaymentStartDate(flRaw);
          if (!anchorYmd) {
            return res.status(400).json({ success: false, message: 'Ankor / ilk dərs tarixi düzgün deyil' });
          }
          await db.query(`UPDATE enrollments SET enrollment_start_date = $1::date WHERE id = $2`, [
            anchorYmd,
            enrollmentId,
          ]);
        }
      } else if (wantsChange) {
        const firstYmd = parsePaymentStartDate(flRaw);
        const enrSlice =
          ent.enrollment_start_date != null ? String(ent.enrollment_start_date).slice(0, 10) : '';
        const enrollmentYmd = parsePaymentStartDate(enrSlice);
        if (!firstYmd) {
          return res.status(400).json({ success: false, message: 'İlk dərs tarixi düzgün deyil' });
        }
        if (!enrollmentYmd) {
          return res.status(400).json({
            success: false,
            message: 'Dərslərə başlama tarixi əvvəlcə düzgün saxlanılmalıdır',
          });
        }
        if (firstYmd < enrollmentYmd) {
          return res.status(400).json({
            success: false,
            message: 'İlk dərs tarixi, dərslərə başlama tarixindən əvvəl ola bilməz',
          });
        }
        if (Number(ent.billing_cycle ?? 1) !== 1) {
          return res.status(400).json({
            success: false,
            message: 'İlk dərs tarixini yalnız birinci dövr üzrə dəyişmək mümkündür (növbəti paketə keçilib).',
          });
        }
        const wd = weekdayFromYmd(firstYmd);
        const lwdNow = parseLessonWeekdays(ent.lesson_weekdays);
        const ltNow = parseLessonTimes(ent.lesson_times, lwdNow);
        if (!wd || !lwdNow.includes(wd) || !ltNow[String(wd)]) {
          return res.status(400).json({
            success: false,
            message: 'İlk dərs tarixi dərs günləri və saatları ilə uyğun deyil',
          });
        }
        const niFresh = normUuid(ent.instructor_id);
        try {
          await db.transaction(async (client) => {
            await replaceCycleOneScheduledLessons(client, {
              enrollmentId,
              studentId: ent.student_id,
              instructor_id: ent.instructor_id,
              ni: niFresh,
              lwd: lwdNow,
              lt: ltNow,
              firstYmd,
              limit: lim,
            });
          });
        } catch (e) {
          if (e.code === 'LESSON_CONFLICT') {
            return res.status(409).json({
              success: false,
              message: `Dərs cədvəlində uyğun olmayan vaxt var: ${e.at || ''}`.trim(),
            });
          }
          if (e.statusCode) return res.status(e.statusCode).json({ success: false, message: e.message });
          throw e;
        }
      }
    }

    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Müəllim/Admin: enrollment üzrə dərs cədvəli (dated lessons)
router.get('/enrollment/:enrollmentId/lessons', authenticate, authorize('admin', 'instructor'), async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { rows: enr } = await db.query(
      'SELECT id, instructor_id, student_id FROM enrollments WHERE id = $1',
      [enrollmentId]
    );
    if (!enr[0]) return res.status(404).json({ success: false, message: 'Enrollment tapılmadı' });

    if (req.user.role === 'instructor' && !sameUuid(enr[0].instructor_id, req.user.id)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const { rows: lessons } = await db.query(
      `SELECT l.id, l.lesson_date, l.status, l.lesson_number, l.billing_cycle,
              e.lesson_times AS enrollment_lesson_times
       FROM lessons l
       JOIN enrollments e ON e.id = l.enrollment_id
       WHERE l.enrollment_id = $1
       ORDER BY l.lesson_date ASC`,
      [enrollmentId]
    );
    res.json({ success: true, lessons });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id/phone', authenticate, authorize('admin', 'instructor'), async (req, res) => {
  try {
    const { phone } = req.body;
    await db.query('UPDATE users SET phone = $1 WHERE id = $2', [phone, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.patch('/:id/email', authenticate, authorize('admin', 'instructor'), patchStudentEmail);

// Student: get my linked teacher/class (active enrollment).
router.get('/my/link', authenticate, authorize('student'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT e.id AS enrollment_id,
              e.instructor_id,
              ig.id AS group_id,
              ig.name AS group_name,
              COALESCE(NULLIF(TRIM(ist.name), ''), 'Sahəsiz') AS subject_name,
              u.full_name AS instructor_name
       FROM enrollments e
       LEFT JOIN instructor_groups ig ON ig.id = e.group_id
       LEFT JOIN instructor_subjects ist ON ist.id = e.subject_id
       LEFT JOIN users u ON u.id = e.instructor_id
       WHERE e.student_id = $1
         AND COALESCE(LOWER(TRIM(e.status)), 'active') = 'active'
       ORDER BY e.enrolled_at DESC NULLS LAST
       LIMIT 1`,
      [req.user.id],
    );
    const r = rows[0] || null;
    res.json({ success: true, link: r });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Student: join a teacher class by join code.
router.post('/my/join', authenticate, authorize('student'), async (req, res) => {
  try {
    const raw = String(req.body?.code || '').trim().toUpperCase();
    const code = raw.replace(/\s+/g, '');
    if (!code) return res.status(400).json({ success: false, message: 'Join kodu tələb olunur' });

    const { rows: grpRows } = await db.query(
      `SELECT ig.id AS group_id,
              ig.instructor_id,
              ig.subject_id,
              ig.name AS group_name,
              ig.join_code,
              ig.join_code_expires_at,
              COALESCE(NULLIF(TRIM(ist.name), ''), 'Sahəsiz') AS subject_name
       FROM instructor_groups ig
       LEFT JOIN instructor_subjects ist ON ist.id = ig.subject_id
       WHERE UPPER(TRIM(ig.join_code)) = $1
       LIMIT 1`,
      [code],
    );
    const g = grpRows[0];
    if (!g) {
      return res.status(404).json({ success: false, code: 'INVALID_CODE', message: 'Kod yanlışdır' });
    }
    if (g.join_code_expires_at && new Date(g.join_code_expires_at).getTime() < Date.now()) {
      return res.status(410).json({ success: false, code: 'EXPIRED_CODE', message: 'Kodun müddəti bitib' });
    }

    // Prevent duplicate join (same group) and restrict to one active teacher by default.
    const { rows: existing } = await db.query(
      `SELECT id, instructor_id, group_id, status
       FROM enrollments
       WHERE student_id = $1
         AND COALESCE(LOWER(TRIM(status)), 'active') = 'active'
       ORDER BY enrolled_at DESC NULLS LAST
       LIMIT 5`,
      [req.user.id],
    );
    const alreadyInGroup = existing.find((e) => String(e.group_id || '') === String(g.group_id));
    if (alreadyInGroup) {
      return res.json({ success: true, code: 'ALREADY_JOINED', message: 'Bu qrupa artıq qoşulmusunuz' });
    }
    const hasOtherTeacher = existing.find((e) => String(e.instructor_id || '') !== String(g.instructor_id));
    if (hasOtherTeacher) {
      return res.status(409).json({
        success: false,
        code: 'ALREADY_LINKED',
        message: 'Siz artıq başqa müəllimə qoşulmusunuz',
      });
    }

    const { rows: enr } = await db.query(
      `INSERT INTO enrollments (instructor_id, student_id, status, enrolled_at)
       VALUES ($1, $2, 'active', NOW())
       RETURNING id`,
      [g.instructor_id, req.user.id],
    );
    const enrollmentId = enr[0]?.id;

    // Best-effort: set subject_id / group_id if columns exist in DB.
    await db
      .query(
        `UPDATE enrollments
         SET subject_id = $2,
             group_id = $3
         WHERE id = $1`,
        [enrollmentId, g.subject_id || null, g.group_id],
      )
      .catch(() => {});

    return res.json({
      success: true,
      message: 'Qrupa qoşuldunuz',
      enrollment_id: enrollmentId,
      teacher_id: g.instructor_id,
      class: { id: g.group_id, name: g.group_name, subject: g.subject_name, join_code: g.join_code },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/my/schedule', authenticate, authorize('student'), getMySchedule);
router.post('/my/prep-slots', authenticate, authorize('student'), addMyPrepSlots);
router.delete('/my/prep-slots/:id', authenticate, authorize('student'), deleteMyPrepSlot);

router.get(
  '/instructor/my-lessons',
  authenticate,
  authorize('instructor', 'admin'),
  getInstructorMyLessonsCalendar
);

router.get('/:id', authenticate, getStudent);

module.exports = router;
