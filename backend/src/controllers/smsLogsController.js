const db = require('../utils/db');
const { computeMonthlyCycleProgress, getTodayBakuYmd, toYmd } = require('../services/subscriptionBilling');
const { sendSms } = require('../services/smsService');

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
        // Include explicit payment t