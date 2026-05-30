const db = require('../utils/db');
const { getGroupLessonSchedule } = require('./studentEnrollmentsService');

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
  return [...new Set(arr.map((x) => parseInt(String(x), 10)).filter((n) => n >= 1 && n <= 7))].sort(
    (a, b) => a - b,
  );
}

function parseLessonTimes(raw, lwd) {
  if (raw == null || !lwd.length) return {};
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
  for (const d of lwd) {
    const v = obj[d] ?? obj[String(d)];
    if (v == null || String(v).trim() === '') continue;
    out[String(d)] = String(v).slice(0, 5);
  }
  return out;
}

function parsePackageFee(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function normalizeBillingType(v) {
  const s = String(v || '').trim().toLowerCase();
  if (s === '12_lessons' || s === '12') return '12_lessons';
  return '8_lessons';
}

function parseGroupDefaultsPayload(body) {
  const lwd = parseLessonWeekdays(body?.default_lesson_weekdays ?? body?.lesson_weekdays);
  const lt = parseLessonTimes(
    body?.default_lesson_times ?? body?.lesson_times,
    lwd,
  );
  const billing_timing =
    String((body?.default_billing_timing ?? body?.billing_timing) || '')
      .trim()
      .toLowerCase() === 'prepaid'
      ? 'prepaid'
      : 'postpaid';
  const payment_plan =
    String((body?.default_payment_plan ?? body?.payment_plan) || '')
      .trim()
      .toLowerCase() === 'partial'
      ? 'partial'
      : 'full';
  const ips = String((body?.default_initial_payment_status ?? body?.initial_payment_status) || 'unpaid')
    .trim()
    .toLowerCase();
  const initial_payment_status = ['paid', 'partial', 'unpaid'].includes(ips) ? ips : 'unpaid';

  return {
    billing_type: normalizeBillingType(body?.default_billing_type ?? body?.billing_type),
    package_fee: parsePackageFee(body?.default_package_fee ?? body?.package_fee ?? body?.monthly_fee),
    billing_timing,
    payment_plan,
    lesson_weekdays: lwd,
    lesson_times: lt,
    notifications_enabled: body?.default_notifications_enabled !== false,
    initial_payment_status,
  };
}

function rowToDefaults(row) {
  if (!row) return null;
  const lwd = parseLessonWeekdays(row.default_lesson_weekdays);
  const lt = parseLessonTimes(row.default_lesson_times, lwd);
  const billing_type = normalizeBillingType(row.default_billing_type);
  if (!lwd.length || !Object.keys(lt).length) return null;
  return {
    billing_type,
    package_fee: row.default_package_fee != null ? Number(row.default_package_fee) : null,
    billing_timing: String(row.default_billing_timing || 'postpaid').toLowerCase() === 'prepaid' ? 'prepaid' : 'postpaid',
    payment_plan: String(row.default_payment_plan || 'full').toLowerCase() === 'partial' ? 'partial' : 'full',
    lesson_weekdays: lwd,
    lesson_times: lt,
    notifications_enabled: row.default_notifications_enabled !== false,
    initial_payment_status: String(row.default_initial_payment_status || 'unpaid').toLowerCase(),
    source: 'group',
  };
}

async function getPeerEnrollmentDefaults(groupId) {
  const { rows } = await db.query(
    `SELECT billing_type,
            monthly_fee,
            billing_timing,
            payment_plan,
            lesson_weekdays,
            lesson_times,
            notifications_enabled,
            initial_payment_status
     FROM enrollments e
     JOIN student_profiles sp ON sp.user_id = e.student_id
     WHERE e.group_id = $1
       AND (e.deleted_at IS NULL)
       AND COALESCE(LOWER(TRIM(e.status)), 'active') = 'active'
       AND e.configured_at IS NOT NULL
       AND e.billing_type IS NOT NULL
     ORDER BY e.configured_at DESC NULLS LAST
     LIMIT 1`,
    [groupId],
  );
  const r = rows[0];
  if (!r) return null;
  const lwd = parseLessonWeekdays(r.lesson_weekdays);
  const lt = parseLessonTimes(r.lesson_times, lwd);
  if (!lwd.length) return null;
  return {
    billing_type: normalizeBillingType(r.billing_type),
    package_fee: r.monthly_fee != null ? Number(r.monthly_fee) : null,
    billing_timing: String(r.billing_timing || 'postpaid').toLowerCase() === 'prepaid' ? 'prepaid' : 'postpaid',
    payment_plan: String(r.payment_plan || 'full').toLowerCase() === 'partial' ? 'partial' : 'full',
    lesson_weekdays: lwd,
    lesson_times: lt,
    notifications_enabled: r.notifications_enabled !== false,
    initial_payment_status: String(r.initial_payment_status || 'unpaid').toLowerCase(),
    source: 'peer_enrollment',
  };
}

/** Qrupun dəvət şablonu: əvvəl qrup sütunları, sonra aktiv tələbə şablonu, sonra teacher_schedules. */
async function getGroupInviteDefaults(groupId) {
  const { rows } = await db.query(
    `SELECT id, subject_id, instructor_id, name,
            default_billing_type, default_package_fee, default_billing_timing,
            default_payment_plan, default_lesson_weekdays, default_lesson_times,
            default_notifications_enabled, default_initial_payment_status
     FROM instructor_groups
     WHERE id = $1
     LIMIT 1`,
    [groupId],
  );
  const g = rows[0];
  if (!g) return null;

  const fromGroup = rowToDefaults(g);
  if (fromGroup) return { ...fromGroup, group_id: g.id, subject_id: g.subject_id, instructor_id: g.instructor_id };

  const fromPeer = await getPeerEnrollmentDefaults(groupId);
  if (fromPeer) {
    return { ...fromPeer, group_id: g.id, subject_id: g.subject_id, instructor_id: g.instructor_id };
  }

  const sched = await getGroupLessonSchedule(groupId);
  if (sched.lesson_weekdays?.length && Object.keys(sched.lesson_times || {}).length) {
    return {
      billing_type: '8_lessons',
      package_fee: null,
      billing_timing: 'postpaid',
      payment_plan: 'full',
      lesson_weekdays: sched.lesson_weekdays,
      lesson_times: sched.lesson_times,
      notifications_enabled: true,
      initial_payment_status: 'unpaid',
      source: 'schedule_only',
      group_id: g.id,
      subject_id: g.subject_id,
      instructor_id: g.instructor_id,
    };
  }

  return null;
}

function assertGroupDefaultsReady(def) {
  if (!def) {
    const err = new Error(
      'Qrup paketi tam deyil. Tənzimləmələrdə qrupa 8/12 dərs, qiymət və dərs günləri/saatları təyin edin.',
    );
    err.statusCode = 400;
    err.code = 'GROUP_DEFAULTS_INCOMPLETE';
    throw err;
  }
  if (!def.lesson_weekdays?.length || !Object.keys(def.lesson_times || {}).length) {
    const err = new Error('Qrup üçün dərs günləri və saatları tələb olunur');
    err.statusCode = 400;
    throw err;
  }
  if (!def.billing_type || (def.billing_type !== '8_lessons' && def.billing_type !== '12_lessons')) {
    const err = new Error('Qrup paketi 8 və ya 12 dərs olmalıdır');
    err.statusCode = 400;
    throw err;
  }
}

module.exports = {
  parseLessonWeekdays,
  parseLessonTimes,
  parseGroupDefaultsPayload,
  rowToDefaults,
  getGroupInviteDefaults,
  assertGroupDefaultsReady,
  normalizeBillingType,
};
