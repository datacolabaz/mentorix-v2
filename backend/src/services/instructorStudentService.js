const db = require('../utils/db');
const { getActivePlansMap } = require('./subscriptionPlansService');
const { higherPaidPlansLabel } = require('./billingAlertHelpers');
const { normalizePlanSlug } = require('../config/plans');
const getCurrentPlan = require('./billingGetCurrentPlan');
const { canonicalStudentPhone, STUDENT_CONTACT_PHONE_SQL } = require('../utils/studentPhone');

const STUDENT_LIMIT_MESSAGE = 'Bu müəllimin pulsuz tələbə limiti dolub.';

function clientIp(req) {
  const xf = req?.headers?.['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim().slice(0, 64);
  return String(req?.ip || req?.socket?.remoteAddress || '').slice(0, 64) || null;
}

function deviceFingerprint(req) {
  const raw = req?.headers?.['x-device-fingerprint'] || req?.body?.device_fingerprint;
  const s = raw != null ? String(raw).trim() : '';
  return s ? s.slice(0, 128) : null;
}

async function countDistinctStudents(instructorId, dbConn = db) {
  const { rows } = await dbConn.query(
    `SELECT COUNT(DISTINCT student_id)::int AS n
     FROM instructor_students
     WHERE instructor_id = $1::uuid`,
    [instructorId],
  );
  return Number(rows[0]?.n ?? 0) || 0;
}

async function hasInstructorStudentLink(instructorId, studentId, dbConn = db) {
  const { rows } = await dbConn.query(
    `SELECT id FROM instructor_students
     WHERE instructor_id = $1::uuid AND student_id = $2::uuid
     LIMIT 1`,
    [instructorId, studentId],
  );
  return Boolean(rows[0]?.id);
}

async function syncUsageStudentsCount(instructorId, dbConn = db) {
  const n = await countDistinctStudents(instructorId, dbConn);
  await dbConn
    .query(
      `INSERT INTO usage_counters (user_id, students_count, storage_used_mb, storage_used_bytes, sms_used_monthly, sms_period_ym)
       VALUES ($1, $2, 0, 0, 0, to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku'), 'YYYY-MM'))
       ON CONFLICT (user_id) DO UPDATE
       SET students_count = $2, updated_at = NOW()`,
      [instructorId, n],
    )
    .catch(() => {});
  return n;
}

async function resolveStudentVerifiedPhone(studentId, dbConn = db) {
  const { rows } = await dbConn.query(
    `SELECT ${STUDENT_CONTACT_PHONE_SQL} AS phone
     FROM users u
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     WHERE u.id = $1::uuid LIMIT 1`,
    [studentId],
  );
  return canonicalStudentPhone(rows[0]?.phone);
}

async function getInstructorStudentLimit(instructorId) {
  try {
    const sub = await getCurrentPlan(db, instructorId);
    const planSlug = normalizePlanSlug(sub?.plan);
    const plansMap = await getActivePlansMap();
    const lim =
      plansMap[planSlug]?.limits?.students ??
      plansMap.basic?.limits?.students ??
      5;
    return lim == null ? null : Number(lim);
  } catch {
    return 5;
  }
}

async function notifyInstructorLimitBlocked(instructorId, limit) {
  const lim = limit == null ? '∞' : String(limit);
  const title = 'Tələbə limiti dolub';
  const plansMap = await getActivePlansMap().catch(() => ({}));
  const hint = higherPaidPlansLabel(plansMap, 'basic');
  const body = `Tələbə limitiniz (${lim}/${lim}) dolub! Yeni tələbələrin linklərinizə daxil ola bilməsi üçün paketinizi ${hint} keçirin.`;
  const { rows } = await db.query(
    `SELECT 1 FROM notifications
     WHERE user_id = $1::uuid
       AND type = 'student_limit_block'
       AND created_at > NOW() - INTERVAL '6 hours'
     LIMIT 1`,
    [instructorId],
  );
  if (rows[0]) return;
  await db
    .query(
      `INSERT INTO notifications (user_id, title, body, type, is_read, meta)
       VALUES ($1, $2, $3, 'student_limit_block', FALSE, $4::jsonb)`,
      [instructorId, title, body, JSON.stringify({ limit })],
    )
    .catch(() => {});
}

/**
 * Yeni unikal tələbə əlavə etmədən əvvəl limit yoxlaması.
 * Artıq bağlı tələbə üçün icazə verilir.
 */
async function ensureInstructorCanAddStudent(instructorId, studentId, opts = {}) {
  if (!instructorId || !studentId) {
    const err = new Error('Müəllim və ya tələbə tapılmadı');
    err.statusCode = 400;
    throw err;
  }

  const existing = await hasInstructorStudentLink(instructorId, studentId);
  if (existing) return { allowed: true, existing: true, count: await countDistinctStudents(instructorId) };

  const limit = await getInstructorStudentLimit(instructorId);
  const count = await countDistinctStudents(instructorId);

  if (limit != null && count >= limit) {
    if (opts.notifyInstructor !== false) {
      await notifyInstructorLimitBlocked(instructorId, limit);
    }
    const err = new Error(
      opts.studentMessage || (limit <= 5 ? STUDENT_LIMIT_MESSAGE : 'Bu müəllimin tələbə limiti dolub.'),
    );
    err.statusCode = 403;
    err.code = 'INSTRUCTOR_STUDENT_LIMIT';
    err.limit = limit;
    err.used = count;
    throw err;
  }

  return { allowed: true, existing: false, count, limit };
}

/**
 * instructor_students cədvəlinə yaz + usage_counters sinxron.
 */
async function trackInstructorStudentLink(
  instructorId,
  studentId,
  opts = {},
  dbConn = db,
) {
  if (!instructorId || !studentId) return null;

  if (!opts.skipLimitCheck) {
    await ensureInstructorCanAddStudent(instructorId, studentId, {
      notifyInstructor: opts.notifyInstructor,
      studentMessage: opts.studentMessage,
    });
  }

  const verifiedPhone =
    opts.verifiedPhone != null
      ? canonicalStudentPhone(opts.verifiedPhone)
      : await resolveStudentVerifiedPhone(studentId, dbConn);

  const { rows } = await dbConn.query(
    `INSERT INTO instructor_students (
       instructor_id, student_id, verified_phone, device_fingerprint, ip_address
     ) VALUES ($1::uuid, $2::uuid, $3, $4, $5)
     ON CONFLICT (instructor_id, student_id) DO UPDATE SET
       verified_phone = COALESCE(EXCLUDED.verified_phone, instructor_students.verified_phone),
       device_fingerprint = COALESCE(EXCLUDED.device_fingerprint, instructor_students.device_fingerprint),
       ip_address = COALESCE(EXCLUDED.ip_address, instructor_students.ip_address)
     RETURNING id, instructor_id, student_id, created_at`,
    [
      instructorId,
      studentId,
      verifiedPhone,
      opts.deviceFingerprint || null,
      opts.ipAddress || null,
    ],
  );

  const n = await syncUsageStudentsCount(instructorId, dbConn);
  return { row: rows[0] || null, count: n };
}

async function trackFromRequest(instructorId, studentId, req, extra = {}) {
  return trackInstructorStudentLink(instructorId, studentId, {
    verifiedPhone: extra.verifiedPhone,
    deviceFingerprint: deviceFingerprint(req),
    ipAddress: clientIp(req),
    notifyInstructor: extra.notifyInstructor,
    studentMessage: extra.studentMessage,
  });
}

module.exports = {
  STUDENT_LIMIT_MESSAGE,
  countDistinctStudents,
  hasInstructorStudentLink,
  syncUsageStudentsCount,
  ensureInstructorCanAddStudent,
  trackInstructorStudentLink,
  trackFromRequest,
  notifyInstructorLimitBlocked,
};
