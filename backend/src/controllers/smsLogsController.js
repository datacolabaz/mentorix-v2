const db = require('../utils/db');

function clampLimit(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 50;
  return Math.min(200, Math.max(20, Math.trunc(x)));
}

function normDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

function normalizeType(v) {
  const t = String(v || '').trim().toLowerCase();
  if (t === 'otp') return 'otp';
  if (t === 'payment' || t === 'payment_reminder') return 'payment';
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

    const where = [];
    const params = [instructorId];

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

    if (type) {
      params.push(type);
      if (type === 'payment') {
        where.push(`LOWER(COALESCE(b.type, '')) IN ('payment', 'payment_reminder')`);
      } else {
        where.push(`LOWER(COALESCE(b.type, '')) = $${params.length}`);
      }
    }

    if (status) {
      if (status === 'failed') where.push(`(b.status ILIKE 'failed:%' OR LOWER(TRIM(b.status)) = 'failed')`);
      else {
        params.push(status);
        where.push(`LOWER(TRIM(b.status)) = $${params.length}`);
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
      const inferredType = otpLike ? 'otp' : 'payment';

      const stRaw = String(r.status || '').trim();
      const isFailed = stRaw === 'failed' || stRaw.toLowerCase().startsWith('failed:');
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
        status: isFailed ? 'failed' : stRaw || 'sent',
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

module.exports = { getSmsLogs };

