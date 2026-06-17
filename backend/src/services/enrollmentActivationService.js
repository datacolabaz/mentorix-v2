const db = require('../utils/db');
const { bakuTodayYmd } = require('../controllers/monthlyAttendanceController');
const { ensurePackLessonsUpTo } = require('./packLessons');
const { computeFinalPackageFee } = require('../utils/groupPaymentTerms');

function normUuid(id) {
  return String(id).trim().toLowerCase().replace(/-/g, '');
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
  return ((dt.getUTCDay() + 6) % 7) + 1;
}

function nextDateForWeekday(afterYmd, weekday, ymdInclusive) {
  const [y, mo, d] = afterYmd.split('-').map(Number);
  const base = new Date(Date.UTC(y, mo - 1, d));
  const baseDow = ((base.getUTCDay() + 6) % 7) + 1;
  let delta = (weekday - baseDow + 7) % 7;
  if (delta === 0 && !ymdInclusive) delta = 7;
  const dt = new Date(base.getTime() + delta * 86400000);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function alignFirstLessonYmd(anchorYmd, lessonWeekdays, lessonTimes) {
  const lwd = lessonWeekdays;
  if (!anchorYmd || !lwd.length) return anchorYmd;
  const wd = weekdayFromYmd(anchorYmd);
  if (wd && lwd.includes(wd) && lessonTimes[String(wd)]) return anchorYmd;
  let best = null;
  for (const d of lwd) {
    if (!lessonTimes[String(d)]) continue;
    const candidate = nextDateForWeekday(anchorYmd, d, true);
    if (!best || candidate < best) best = candidate;
  }
  return best || anchorYmd;
}

function generateLessonStarts({ startYmd, lessonWeekdays, lessonTimes, count }) {
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
    cursor = best.slice(0, 10);
    const [yy, mm, dd] = cursor.split('-').map(Number);
    const dt = new Date(Date.UTC(yy, mm - 1, dd + 1));
    cursor = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
  }
  return out;
}

async function bakuTodayYmdDb(client) {
  const { rows } = await client.query(
    `SELECT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS ymd`,
  );
  return rows[0]?.ymd || new Date().toISOString().slice(0, 10);
}

async function reserveGroupSlots(client, { ni, lwd, lt, subject_id, group_id }) {
  if (!group_id) return;
  for (const wd of lwd) {
    const t = lt[String(wd)];
    if (!t) continue;
    const start = `${String(t).slice(0, 5)}:00`;
    const { rows: slotRows } = await client.query(
      `SELECT id, is_occupied, group_id
       FROM teacher_schedules
       WHERE REPLACE(LOWER(TRIM(instructor_id::text)), '-', '') = $1
         AND day_of_week = $2
         AND start_time = $3::time
       LIMIT 1`,
      [ni, wd, start],
    );
    if (!slotRows[0]) continue;
    const slot = slotRows[0];
    if (slot.is_occupied && slot.group_id && normUuid(slot.group_id) !== normUuid(group_id)) {
      const err = new Error(`Dərs saatı artıq başqa qrup tərəfindən tutulub (${wd} ${String(t).slice(0, 5)})`);
      err.statusCode = 409;
      err.code = 'LESSON_CONFLICT';
      throw err;
    }
    await client.query(
      `UPDATE teacher_schedules
       SET is_occupied = TRUE, subject_id = $2::uuid, group_id = $3::uuid
       WHERE id = $1::uuid`,
      [slot.id, subject_id || null, group_id],
    );
  }
}

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
    const err = new Error('Qrup cədvəli ilə kifayət qədər dərs yaradılmır');
    err.statusCode = 400;
    throw err;
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
      [enrollmentId, i + 1, starts[i]],
    );
    await client.query(
      `INSERT INTO lessons (enrollment_id, student_id, instructor_id, lesson_date, status, lesson_number, billing_cycle)
       VALUES ($1,$2,$3,($4::timestamp AT TIME ZONE 'Asia/Baku'),'pending',$5,1)
       ON CONFLICT (enrollment_id, billing_cycle, lesson_number) DO NOTHING`,
      [enrollmentId, studentId, instructor_id, starts[i], i + 1],
    );
  }
}

function appendPackageHistory(existing, entry) {
  const base = Array.isArray(existing) ? existing : [];
  return [...base, entry].slice(-50);
}

/**
 * Təsdiq: qrupun paket/cədvəl/qiymətini tələbəyə tətbiq et, 1-ci dövrü yarat.
 */
async function activateEnrollmentFromGroupDefaults(client, opts) {
  const {
    enrollmentId,
    studentId,
    instructorId,
    groupId,
    subjectId,
    defaults,
    studentProfile = {},
    referral_source_id = null,
    referral_notes = null,
  } = opts;

  const ni = normUuid(instructorId);
  const lwd = defaults.lesson_weekdays;
  const lt = defaults.lesson_times;
  const let_ = defaults.lesson_end_times || {};
  const bt = defaults.billing_type;
  const limit = billingLimit(bt);
  const enrollmentYmd = (await bakuTodayYmd()) || new Date().toISOString().slice(0, 10);
  let firstYmd = alignFirstLessonYmd(enrollmentYmd, lwd, lt);
  if (firstYmd < enrollmentYmd) firstYmd = alignFirstLessonYmd(enrollmentYmd, lwd, lt);

  const { rows: enrBefore } = await client.query(
    `SELECT package_history FROM enrollments WHERE id = $1`,
    [enrollmentId],
  );
  const historyEntry = {
    at: new Date().toISOString(),
    action: 'invite_approved',
    billing_type: bt,
    package_fee: defaults.package_fee,
    source: defaults.source || 'group',
  };

  const { rows: updated } = await client.query(
    `UPDATE enrollments SET
       billing_type = $2,
       lesson_weekdays = $3::jsonb,
       lesson_times = $4::jsonb,
       lesson_end_times = $5::jsonb,
       enrollment_start_date = $6::date,
       billing_timing = $7,
       payment_plan = $8,
       subject_id = $9,
       group_id = $10,
       notifications_enabled = $11,
       initial_payment_status = $12,
       discount_percent = $13,
       referral_source_id = $14,
       referral_notes = $15,
       status = 'active',
       configured_at = COALESCE(configured_at, NOW()),
       package_history = $16::jsonb
     WHERE id = $1
     RETURNING *`,
    [
      enrollmentId,
      bt,
      JSON.stringify(lwd),
      JSON.stringify(lt),
      JSON.stringify(let_),
      enrollmentYmd,
      defaults.billing_timing,
      defaults.payment_plan,
      subjectId,
      groupId,
      defaults.notifications_enabled !== false,
      defaults.initial_payment_status || 'unpaid',
      defaults.discount_percent != null ? defaults.discount_percent : null,
      referral_source_id || null,
      referral_notes != null ? String(referral_notes).trim().slice(0, 500) || null : null,
      JSON.stringify(appendPackageHistory(enrBefore[0]?.package_history, historyEntry)),
    ],
  );

  await reserveGroupSlots(client, {
    ni,
    lwd,
    lt,
    subject_id: subjectId,
    group_id: groupId,
  });

  await replaceCycleOneScheduledLessons(client, {
    enrollmentId,
    studentId,
    instructor_id: instructorId,
    ni,
    lwd,
    lt,
    firstYmd,
    limit,
    group_id: groupId,
  });

  const mf = computeFinalPackageFee(defaults.package_fee, defaults.discount_percent);
  const pn = studentProfile.parent_name != null ? String(studentProfile.parent_name).trim() : '';
  const pp = studentProfile.parent_phone != null ? String(studentProfile.parent_phone).trim() : '';
  const pr = await client.query(
    `UPDATE student_profiles SET
       parent_name = COALESCE(NULLIF($1, ''), parent_name),
       parent_phone = COALESCE(NULLIF($2, ''), parent_phone),
       monthly_fee = COALESCE($3, monthly_fee)
     WHERE user_id = $4`,
    [pn, pp, mf != null && Number.isFinite(mf) ? mf : null, studentId],
  );
  if (pr.rowCount === 0) {
    await client.query(
      `INSERT INTO student_profiles (user_id, parent_name, parent_phone, monthly_fee)
       VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), $4)`,
      [studentId, pn, pp, mf != null && Number.isFinite(mf) ? mf : null],
    );
  }

  await ensurePackLessonsUpTo(client, updated[0], { horizonDays: 30 }).catch(() => {});

  const { rows: cntRows } = await client.query(
    `SELECT COUNT(DISTINCT u.id)::int AS n
     FROM enrollments e
     JOIN users u ON u.id = e.student_id
     WHERE e.instructor_id = $1
       AND e.deleted_at IS NULL
       AND COALESCE(LOWER(TRIM(e.status)), 'active') = 'active'
       AND u.is_active = TRUE`,
    [instructorId],
  );
  const n = Number(cntRows[0]?.n ?? 0) || 0;
  await client.query(
    `INSERT INTO usage_counters (user_id, students_count)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET students_count = $2, updated_at = NOW()`,
    [instructorId, n],
  );

  return updated[0];
}

module.exports = {
  activateEnrollmentFromGroupDefaults,
  alignFirstLessonYmd,
  appendPackageHistory,
  billingLimit,
  bakuTodayYmdDb,
  generateLessonStarts,
  reserveGroupSlots,
};
