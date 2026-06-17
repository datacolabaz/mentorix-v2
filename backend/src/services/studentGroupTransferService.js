const db = require('../utils/db');
const { assertGroupMutable, fetchGroupGuard } = require('./systemGroupGuards');
const { getGroupInviteDefaults, assertGroupDefaultsReady } = require('./groupInviteDefaults');
const { ensurePackLessonsUpTo } = require('./packLessons');
const { computeFinalPackageFee, buildPackagePreview } = require('../utils/groupPaymentTerms');
const {
  reserveGroupSlots,
  alignFirstLessonYmd,
  billingLimit,
  bakuTodayYmdDb,
  generateLessonStarts,
  appendPackageHistory,
} = require('./enrollmentActivationService');

const normUuid = (id) => String(id || '').trim().toLowerCase().replace(/-/g, '');

function httpError(message, statusCode = 400, code = null) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
}

async function countUsedCycleLessons(client, enrollmentId, billingCycle = 1) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS n
     FROM lessons
     WHERE enrollment_id = $1::uuid
       AND billing_cycle = $2
       AND COALESCE(deleted_at, NULL) IS NULL
       AND lesson_date <= NOW()`,
    [enrollmentId, billingCycle],
  );
  return Number(rows[0]?.n) || 0;
}

async function deleteFuturePendingCycleLessons(client, enrollmentId, billingCycle, fromYmd) {
  const { rows } = await client.query(
    `SELECT lesson_number FROM lessons
     WHERE enrollment_id = $1::uuid
       AND billing_cycle = $2
       AND LOWER(TRIM(COALESCE(status, 'pending'))) = 'pending'
       AND (lesson_date AT TIME ZONE 'Asia/Baku')::date >= $3::date`,
    [enrollmentId, billingCycle, fromYmd],
  );
  const nums = rows.map((r) => r.lesson_number).filter((n) => n != null)
  await client.query(
    `DELETE FROM lessons
     WHERE enrollment_id = $1::uuid
       AND billing_cycle = $2
       AND LOWER(TRIM(COALESCE(status, 'pending'))) = 'pending'
       AND (lesson_date AT TIME ZONE 'Asia/Baku')::date >= $3::date`,
    [enrollmentId, billingCycle, fromYmd],
  );
  if (nums.length) {
    await client.query(
      `DELETE FROM enrollment_lessons
       WHERE enrollment_id = $1::uuid AND billing_cycle = $2 AND lesson_number = ANY($3::int[])`,
      [enrollmentId, billingCycle, nums],
    );
  }
}

async function appendRemainingCycleLessons(client, params) {
  const {
    enrollmentId,
    studentId,
    instructorId,
    groupId,
    lwd,
    lt,
    billingType,
    completedCount,
    billingCycle = 1,
  } = params;
  const limit = billingLimit(billingType);
  if (!limit) return 0;
  const remaining = Math.max(0, limit - Math.max(0, completedCount || 0));
  if (!remaining) return 0;

  const todayBaku = await bakuTodayYmdDb(client);
  let firstYmd = alignFirstLessonYmd(todayBaku, lwd, lt);
  if (firstYmd < todayBaku) {
    firstYmd = alignFirstLessonYmd(todayBaku, lwd, lt);
  }

  const starts = generateLessonStarts({
    startYmd: firstYmd,
    lessonWeekdays: lwd,
    lessonTimes: lt,
    count: remaining,
  });
  if (starts.length < remaining) {
    throw httpError('Yeni qrup cədvəli ilə qalan dərslər üçün kifayət qədər slot tapılmadı', 409, 'LESSON_CONFLICT');
  }

  const { rows: maxRows } = await client.query(
    `SELECT COALESCE(MAX(lesson_number), 0)::int AS mx
     FROM lessons
     WHERE enrollment_id = $1::uuid AND billing_cycle = $2`,
    [enrollmentId, billingCycle],
  );
  let lessonNo = Number(maxRows[0]?.mx) || 0;

  for (const startsAt of starts) {
    lessonNo += 1;
    await client.query(
      `INSERT INTO enrollment_lessons (enrollment_id, billing_cycle, lesson_number, starts_at)
       VALUES ($1, $2, $3, $4::timestamp)
       ON CONFLICT (enrollment_id, billing_cycle, lesson_number) DO NOTHING`,
      [enrollmentId, billingCycle, lessonNo, startsAt],
    );
    await client.query(
      `INSERT INTO lessons (enrollment_id, student_id, instructor_id, lesson_date, status, lesson_number, billing_cycle)
       VALUES ($1,$2,$3,($4::timestamp AT TIME ZONE 'Asia/Baku'),'pending',$5,$6)
       ON CONFLICT (enrollment_id, billing_cycle, lesson_number) DO NOTHING`,
      [enrollmentId, studentId, instructorId, startsAt, lessonNo, billingCycle],
    );
  }

  await client.query(`UPDATE enrollments SET lesson_count = $2 WHERE id = $1::uuid`, [
    enrollmentId,
    completedCount,
  ]);

  await client.query(
    `UPDATE teacher_schedules
     SET student_id = $1::uuid, enrollment_id = $2::uuid
     WHERE REPLACE(LOWER(TRIM(instructor_id::text)), '-', '') = $3
       AND group_id = $4::uuid
       AND is_occupied = TRUE`,
    [studentId, enrollmentId, normUuid(instructorId), groupId],
  ).catch(() => {});

  return remaining;
}

async function syncGroupMembership(client, { instructorId, studentId, sourceGroupId, targetGroupId, subjectId }) {
  if (sourceGroupId) {
    await client.query(
      `DELETE FROM instructor_group_members
       WHERE instructor_id = $1::uuid AND student_id = $2::uuid AND group_id = $3::uuid`,
      [instructorId, studentId, sourceGroupId],
    );
  }
  if (targetGroupId) {
    await client.query(
      `INSERT INTO instructor_group_members (
         instructor_id, student_id, group_id, subject_id, membership_source, joined_at
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'group', NOW())
       ON CONFLICT (group_id, student_id) DO UPDATE
         SET subject_id = EXCLUDED.subject_id,
             membership_source = 'group',
             joined_at = NOW()`,
      [instructorId, studentId, targetGroupId, subjectId],
    );
  }
}

async function countGroupEnrollments(client, groupId, instructorId) {
  if (!groupId) return 0;
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS n
     FROM enrollments e
     WHERE e.group_id = $1::uuid
       AND e.instructor_id = $2::uuid
       AND e.deleted_at IS NULL
       AND COALESCE(LOWER(TRIM(e.status)), 'active') NOT IN ('rejected', 'left', 'archived')`,
    [groupId, instructorId],
  );
  return Number(rows[0]?.n) || 0;
}

async function getTransferPreview(instructorId, targetGroupId) {
  const grp = await fetchGroupGuard(null, targetGroupId, instructorId);
  if (!grp) throw httpError('Hədəf qrup tapılmadı', 404);
  if (grp.is_system) throw httpError('Sistem qrupuna köçürmə mümkün deyil', 400);

  const defaults = await getGroupInviteDefaults(targetGroupId);
  const preview = defaults ? buildPackagePreview(defaults) : null;
  return {
    target_group_id: targetGroupId,
    target_group_name: grp.name,
    package_preview: preview,
    has_schedule: Boolean(defaults?.lesson_weekdays?.length && Object.keys(defaults?.lesson_times || {}).length),
  };
}

async function transferStudentBetweenGroups({
  instructorId,
  enrollmentId,
  sourceGroupId,
  targetGroupId,
  pricingMode = 'apply_target',
  scheduleEffective = 'immediate',
}) {
  const pricing_mode = String(pricingMode || 'apply_target').toLowerCase() === 'keep_existing'
    ? 'keep_existing'
    : 'apply_target';
  const schedule_effective = String(scheduleEffective || 'immediate').toLowerCase() === 'next_cycle'
    ? 'next_cycle'
    : 'immediate';

  if (!enrollmentId || !targetGroupId) {
    throw httpError('enrollment_id və target_group_id tələb olunur');
  }

  return db.transaction(async (client) => {
    const { rows: enrRows } = await client.query(
      `SELECT e.*, sp.monthly_fee, u.full_name AS student_name
       FROM enrollments e
       JOIN users u ON u.id = e.student_id
       LEFT JOIN student_profiles sp ON sp.user_id = e.student_id
       WHERE e.id = $1::uuid
         AND e.instructor_id = $2::uuid
         AND e.deleted_at IS NULL
       LIMIT 1`,
      [enrollmentId, instructorId],
    );
    const enr = enrRows[0];
    if (!enr) throw httpError('Qeydiyyat tapılmadı', 404);

    const status = String(enr.status || '').toLowerCase();
    if (['pending_approval', 'pending_setup', 'rejected', 'left', 'archived'].includes(status)) {
      throw httpError('Bu statusda olan tələbəni köçürmək olmaz', 400);
    }

    const currentGroupId = enr.group_id;
    const effSource = sourceGroupId || currentGroupId;
    if (effSource && normUuid(effSource) === normUuid(targetGroupId)) {
      throw httpError('Tələbə artıq bu qrupdadır', 400);
    }

    const sourceGrp = effSource ? await fetchGroupGuard(client, effSource, instructorId) : null;
    if (sourceGrp?.is_system) {
      throw httpError('Sistem qrupundan birbaşa köçürmə üçün "iştirakçını təsdiqlə" funksiyasından istifadə edin', 400);
    }

    await assertGroupMutable(targetGroupId, instructorId, 'transfer_target', client);
    const targetGrp = await fetchGroupGuard(client, targetGroupId, instructorId);
    if (!targetGrp) throw httpError('Hədəf qrup tapılmadı', 404);

    const targetDefaults = await getGroupInviteDefaults(targetGroupId);
    if (pricing_mode === 'apply_target') {
      assertGroupDefaultsReady(targetDefaults);
    } else if (schedule_effective === 'immediate') {
      if (
        !targetDefaults?.lesson_weekdays?.length ||
        !Object.keys(targetDefaults?.lesson_times || {}).length
      ) {
        throw httpError('Hədəf qrupun dərs cədvəli tam deyil', 400, 'GROUP_DEFAULTS_INCOMPLETE');
      }
    }

    const completedLessons = await countUsedCycleLessons(client, enrollmentId, 1);
    const historyEntry = {
      at: new Date().toISOString(),
      action: 'group_transfer',
      from_group_id: effSource || null,
      to_group_id: targetGroupId,
      pricing_mode,
      schedule_effective,
      completed_lessons_cycle_1: completedLessons,
    };

    const packageHistory = appendPackageHistory(enr.package_history, historyEntry);
    const ni = normUuid(instructorId);

    let nextBillingType = enr.billing_type;
    let nextDiscount = enr.discount_percent;
    let nextBillingTiming = enr.billing_timing;
    let nextPaymentPlan = enr.payment_plan;
    let nextInitialPayment = enr.initial_payment_status;
    let nextNotifications = enr.notifications_enabled;
    let nextLwd = enr.lesson_weekdays;
    let nextLt = enr.lesson_times;
    let nextLet = enr.lesson_end_times;
    let nextMonthlyFee = enr.monthly_fee;

    if (pricing_mode === 'apply_target' && targetDefaults) {
      nextBillingType = targetDefaults.billing_type;
      nextDiscount = targetDefaults.discount_percent;
      nextBillingTiming = targetDefaults.billing_timing;
      nextPaymentPlan = targetDefaults.payment_plan;
      nextInitialPayment = targetDefaults.initial_payment_status || 'unpaid';
      nextNotifications = targetDefaults.notifications_enabled !== false;
      nextMonthlyFee = computeFinalPackageFee(
        targetDefaults.package_fee,
        targetDefaults.discount_percent,
      );
    }

    if (schedule_effective === 'immediate' && targetDefaults) {
      nextLwd = targetDefaults.lesson_weekdays;
      nextLt = targetDefaults.lesson_times;
      nextLet = targetDefaults.lesson_end_times || {};
    }

    const lwdArr = Array.isArray(nextLwd)
      ? nextLwd
      : (() => {
          try {
            return JSON.parse(nextLwd || '[]');
          } catch {
            return [];
          }
        })();
    const ltObj =
      nextLt && typeof nextLt === 'object' && !Array.isArray(nextLt)
        ? nextLt
        : (() => {
            try {
              return JSON.parse(nextLt || '{}');
            } catch {
              return {};
            }
          })();

    const { rows: updatedRows } = await client.query(
      `UPDATE enrollments SET
         group_id = $2::uuid,
         subject_id = $3::uuid,
         billing_type = $4,
         discount_percent = $5,
         billing_timing = $6,
         payment_plan = $7,
         initial_payment_status = $8,
         notifications_enabled = $9,
         lesson_weekdays = $10::jsonb,
         lesson_times = $11::jsonb,
         lesson_end_times = $12::jsonb,
         package_history = $13::jsonb,
         configured_at = COALESCE(configured_at, NOW())
       WHERE id = $1::uuid
       RETURNING *`,
      [
        enrollmentId,
        targetGroupId,
        targetGrp.subject_id || enr.subject_id,
        nextBillingType,
        nextDiscount,
        nextBillingTiming,
        nextPaymentPlan,
        nextInitialPayment,
        nextNotifications,
        JSON.stringify(lwdArr),
        JSON.stringify(ltObj),
        JSON.stringify(nextLet || {}),
        JSON.stringify(packageHistory),
      ],
    );

    if (pricing_mode === 'apply_target' && nextMonthlyFee != null) {
      await client.query(
        `UPDATE student_profiles SET monthly_fee = $2 WHERE user_id = $1::uuid`,
        [enr.student_id, nextMonthlyFee],
      );
    }

    if (schedule_effective === 'immediate' && lwdArr.length) {
      await reserveGroupSlots(client, {
        ni,
        lwd: lwdArr,
        lt: ltObj,
        subject_id: targetGrp.subject_id,
        group_id: targetGroupId,
      });

      const todayBaku = await bakuTodayYmdDb(client);
      await deleteFuturePendingCycleLessons(client, enrollmentId, 1, todayBaku);
      await appendRemainingCycleLessons(client, {
        enrollmentId,
        studentId: enr.student_id,
        instructorId,
        groupId: targetGroupId,
        lwd: lwdArr,
        lt: ltObj,
        billingType: nextBillingType,
        completedCount: completedLessons,
        billingCycle: 1,
      });
      await ensurePackLessonsUpTo(client, updatedRows[0], { horizonDays: 30 }).catch(() => {});
    }

    await syncGroupMembership(client, {
      instructorId,
      studentId: enr.student_id,
      sourceGroupId: effSource,
      targetGroupId,
      subjectId: targetGrp.subject_id,
    });

    let sourceGroupPayload = null;
    if (effSource && sourceGrp && !sourceGrp.is_system) {
      const remaining = await countGroupEnrollments(client, effSource, instructorId);
      sourceGroupPayload = {
        id: effSource,
        name: sourceGrp.name,
        is_empty: remaining === 0,
        remaining_students: remaining,
      };
    }

    return {
      enrollment: updatedRows[0],
      student_id: enr.student_id,
      student_name: enr.student_name,
      source_group_id: effSource,
      source_group_name: sourceGrp?.name || null,
      source_group: sourceGroupPayload,
      target_group_id: targetGroupId,
      target_group_name: targetGrp.name,
      pricing_mode,
      schedule_effective,
      completed_lessons_preserved: completedLessons,
    };
  });
}

module.exports = {
  transferStudentBetweenGroups,
  getTransferPreview,
};
