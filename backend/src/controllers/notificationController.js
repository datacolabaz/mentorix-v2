const db = require('../utils/db');
const { recomputeInstructorUsage } = require('../services/resourceUsageService');
const { sendRawSms } = require('../services/smsService');

function readProviderCode(json) {
  const j = json;
  const candidates = [
    j?.response?.head?.responsecode,
    j?.response?.head?.responseCode,
    j?.response?.responsecode,
    j?.response?.responseCode,
    j?.responsecode,
    j?.responseCode,
  ];
  for (const c of candidates) {
    if (c === undefined || c === null || c === '') continue;
    const n = typeof c === 'number' ? c : parseInt(String(c).trim(), 10);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function interpretSendRawSms(raw) {
  if (!raw || raw.ok !== true) return { ok: false, status: 'failed', reason: raw?.error || 'HTTP request failed' };
  const j = raw.json;
  if (!j) return { ok: false, status: 'failed', reason: 'Empty provider JSON' };

  const rc = readProviderCode(j);
  if (rc != null && rc !== 0 && rc !== 200) {
    return { ok: false, status: 'failed', reason: `SMS provider responsecode: ${rc}` };
  }
  if (j.error || j.response?.error) {
    return { ok: false, status: 'failed', reason: j.error || j.response?.error || 'Provider error' };
  }
  const statusRaw = j.response?.status ?? j.status ?? null;
  if (statusRaw != null) {
    const status = String(statusRaw).trim().toLowerCase();
    const bad = new Set(['failed', 'error', 'rejected', 'invalid', 'denied']);
    if (bad.has(status)) return { ok: false, status: 'failed', reason: `SMS provider status: ${String(statusRaw)}` };
    const okSet = new Set(['sent', 'success', 'ok', 'queued', 'accepted', 'submitted', '0', '200']);
    if (okSet.has(status)) return { ok: true, status: String(statusRaw), reason: null };
    return { ok: true, status: String(statusRaw), reason: null };
  }
  return { ok: true, status: 'sent', reason: null };
}

const getAdminNotifications = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.full_name, u.email,
              ip.sms_limit, ip.sms_used, ip.storage_limit_mb, ip.storage_used_mb,
              ip.ram_limit_mb, COALESCE(ip.ram_used_mb, 0) AS ram_used_mb,
              ip.usage_synced_at,
              ROUND((ip.sms_used::float / NULLIF(ip.sms_limit,0)) * 100) AS sms_percent,
              ROUND((ip.storage_used_mb::float / NULLIF(ip.storage_limit_mb,0)) * 100) AS storage_percent,
              ROUND((COALESCE(ip.ram_used_mb,0)::float / NULLIF(ip.ram_limit_mb,0)) * 100) AS ram_percent
       FROM users u
       JOIN instructor_profiles ip ON ip.user_id = u.id
       WHERE u.role = 'instructor' AND u.is_active = TRUE
         AND (
           ip.sms_used >= ip.sms_limit * 0.8
           OR ip.storage_used_mb >= ip.storage_limit_mb * 0.8
           OR COALESCE(ip.ram_used_mb,0) >= ip.ram_limit_mb * 0.8
         )
       ORDER BY sms_percent DESC`
    );

    const alerts = rows.map(r => {
      const list = [];
      if (r.sms_percent >= 80) list.push({
        type: 'sms',
        message: `SMS limiti ${r.sms_percent}% dolub (${r.sms_used}/${r.sms_limit})`,
        level: r.sms_percent >= 100 ? 'critical' : 'warning',
      });
      if (r.storage_percent >= 80) list.push({
        type: 'storage',
        message: `Storage limiti ${r.storage_percent}% dolub (${r.storage_used_mb}/${r.storage_limit_mb}MB)`,
        level: r.storage_percent >= 100 ? 'critical' : 'warning',
      });
      if (r.ram_percent >= 80) list.push({
        type: 'ram',
        message: `RAM limiti ${r.ram_percent}% dolub (${r.ram_used_mb}/${r.ram_limit_mb}MB)`,
        level: r.ram_percent >= 100 ? 'critical' : 'warning',
      });
      return { instructor: { id: r.id, full_name: r.full_name, email: r.email }, alerts: list };
    });

    res.json({ success: true, notifications: alerts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getInstructorNotifications = async (req, res) => {
  try {
    // Sync usage on each refresh for real-time display.
    await recomputeInstructorUsage(req.user.id, { persist: true });

    const { rows } = await db.query(
      `SELECT ip.sms_limit, ip.sms_used,
              ip.storage_limit_mb, ip.storage_used_mb, COALESCE(ip.storage_used_bytes,0) AS storage_used_bytes,
              ip.ram_limit_mb, COALESCE(ip.ram_used_mb, 0) AS ram_used_mb,
              ip.usage_synced_at,
              ROUND((ip.sms_used::float / NULLIF(ip.sms_limit,0)) * 100) AS sms_percent,
              ROUND(((COALESCE(ip.storage_used_bytes,0)::numeric / NULLIF(ip.storage_limit_mb,0)) / 1048576) * 100, 1) AS storage_percent,
              ROUND((COALESCE(ip.ram_used_mb,0)::float / NULLIF(ip.ram_limit_mb,0)) * 100) AS ram_percent
       FROM instructor_profiles ip WHERE ip.user_id = $1`,
      [req.user.id]
    );

    const profile = rows[0];
    const alerts = [];

    if (profile?.sms_percent >= 80) alerts.push({
      type: 'sms',
      message: `SMS limitiniz ${profile.sms_percent}% dolub (${profile.sms_used}/${profile.sms_limit})`,
      level: profile.sms_percent >= 100 ? 'critical' : 'warning',
    });
    if (profile?.storage_percent >= 80) alerts.push({
      type: 'storage',
      message: `Storage limitiniz ${profile.storage_percent}% dolub (${profile.storage_used_mb}/${profile.storage_limit_mb}MB)`,
      level: profile.storage_percent >= 100 ? 'critical' : 'warning',
    });

    if (profile?.ram_percent >= 80) alerts.push({
      type: 'ram',
      message: `RAM limitiniz ${profile.ram_percent}% dolub (${profile.ram_used_mb}/${profile.ram_limit_mb}MB)`,
      level: profile.ram_percent >= 100 ? 'critical' : 'warning',
    });

    res.json({ success: true, alerts, profile: profile || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getStudentNotifications = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, title, body, type, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id],
    );
    res.json({ success: true, notifications: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getInstructorSmsHistory = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const limit = Math.min(200, Math.max(20, Number(req.query.limit || 50) || 50));
    const statusFilter = String(req.query.status || '').trim().toLowerCase(); // sent | failed | scheduled | (empty)

    // Include:
    // - direct instructor sends (instructor_id = $1)
    // - OTP/system messages for this instructor's active students/parents (phone match)
    const where = [
      `(instructor_id = $1 OR regexp_replace(phone, '\\\\D', '', 'g') IN (
        SELECT regexp_replace(u.phone, '\\\\D', '', 'g')
        FROM users u
        JOIN enrollments e ON e.student_id = u.id
        WHERE e.instructor_id = $1
          AND COALESCE(NULLIF(LOWER(TRIM(e.status)), ''), 'active') = 'active'
          AND u.phone IS NOT NULL
        UNION
        SELECT regexp_replace(sp.parent_phone, '\\\\D', '', 'g')
        FROM student_profiles sp
        JOIN enrollments e2 ON e2.student_id = sp.user_id
        WHERE e2.instructor_id = $1
          AND COALESCE(NULLIF(LOWER(TRIM(e2.status)), ''), 'active') = 'active'
          AND sp.parent_phone IS NOT NULL
      ))`,
    ];
    const params = [instructorId];
    if (statusFilter) {
      // We store failures as "failed:<reason>"
      if (statusFilter === 'failed') where.push(`status ILIKE 'failed:%' OR status = 'failed'`);
      else where.push(`LOWER(TRIM(status)) = $${params.length + 1}`);
      if (statusFilter !== 'failed') params.push(statusFilter);
    }

    const { rows } = await db.query(
      `SELECT id, phone, message, status, http_status, msisdn, provider, sent_at
       FROM sms_logs
       WHERE ${where.join(' AND ')}
       ORDER BY sent_at DESC
       LIMIT ${limit}`,
      params
    );

    const items = (rows || []).map((r) => {
      const st = String(r.status || '').trim();
      const isFailed = st === 'failed' || st.toLowerCase().startsWith('failed:');
      const reason = isFailed && st.includes(':') ? st.split(':').slice(1).join(':').trim() : null;
      const msg = String(r.message || '').trim();
      const kind = r.provider?.kind ? String(r.provider.kind) : null;
      const otpLike =
        /\\bkodunuz\\b/i.test(msg) ||
        /^mentorix\\s*:\\s*\\d{3,8}\\b/i.test(msg) ||
        /\\bOTP\\b/i.test(msg);
      const pinLike = /\\bPIN\\b/i.test(msg) || /OTP\\s*yox/i.test(msg) || /daimi\\s+Mentorix\\s+giriş\\s+PIN/i.test(msg);
      const type = kind === 'otp' || otpLike || pinLike ? 'otp' : 'payment_reminder';
      return {
        id: r.id,
        phone: r.phone,
        message: r.message,
        type,
        status: isFailed ? 'failed' : st || 'sent',
        reason,
        createdAt: r.sent_at,
        httpStatus: r.http_status ?? null,
        msisdn: r.msisdn ?? null,
        provider: r.provider ?? null,
      };
    });

    return res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

function normalizeIds(arr) {
  const out = new Set();
  if (!Array.isArray(arr)) return [];
  for (const x of arr) {
    const s = String(x ?? '').trim();
    if (s) out.add(s);
  }
  return [...out];
}

const quickInstructorNotification = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const { message, student_ids, method } = req.body || {};

    const msg = String(message ?? '').trim();
    if (!msg) return res.status(400).json({ success: false, message: 'Mesaj tələb olunur' });

    const ids = normalizeIds(student_ids);
    if (!ids.length) return res.status(400).json({ success: false, message: 'Tələbələr seçilməlidir' });

    const allowedStudentsRes = await db.query(
      `SELECT u.id, u.phone
       FROM users u
       JOIN enrollments e ON e.student_id = u.id
       WHERE e.instructor_id = $1
         AND e.status = 'active'
         AND u.role = 'student'
         AND u.is_active = TRUE
         AND u.id = ANY($2::uuid[])`,
      [instructorId, ids],
    );
    const allowedStudents = allowedStudentsRes.rows || [];
    const allowedIds = allowedStudents.map((r) => r.id);

    if (allowedIds.length !== ids.length) {
      return res.status(400).json({
        success: false,
        message: 'Bəzi tələbələr seçdiyiniz siyahıda yoxdur və ya icazəniz yoxdur',
      });
    }

    const safeMethod = method === 'sms' ? 'sms' : 'internal';
    const title = 'Sürətli Bildiriş';

    if (safeMethod === 'internal') {
      await db.query(
        `INSERT INTO notifications (user_id, title, body, type, is_read)
         SELECT unnest($1::uuid[]), $2, $3, $4, FALSE`,
        [allowedIds, title, msg, 'instructor_panel'],
      );
      return res.json({ success: true, method: 'internal', sent: allowedIds.length });
    }

    // SMS method
    const { rows: profRows } = await db.query(
      `SELECT sms_limit, sms_used
       FROM instructor_profiles
       WHERE user_id = $1`,
      [instructorId],
    );
    const prof = profRows[0];
    const smsLimit = Number(prof?.sms_limit ?? 0);
    const smsUsed = Number(prof?.sms_used ?? 0);

    if (!smsLimit || smsUsed >= smsLimit) {
      return res.status(429).json({
        success: false,
        code: 'SMS_LIMIT_EXCEEDED',
        message: 'Limitiniz bitib, artırmaq üçün adminlə əlaqə saxlayın',
      });
    }

    const studentsWithPhones = allowedStudents.filter((s) => {
      const p = String(s.phone ?? '').trim();
      return !!p;
    });
    if (studentsWithPhones.length !== allowedStudents.length) {
      return res.status(400).json({
        success: false,
        message: 'Bəzi tələbələr üçün telefon nömrəsi tapılmadı',
      });
    }

    const count = studentsWithPhones.length;

    // Reserve quota atomically to never exceed sms_limit in concurrent requests.
    const { rows: updRows } = await db.query(
      `UPDATE instructor_profiles
       SET sms_used = sms_used + $2
       WHERE user_id = $1
         AND sms_used + $2 <= sms_limit
       RETURNING sms_used`,
      [instructorId, count],
    );

    if (!updRows.length) {
      return res.status(429).json({
        success: false,
        code: 'SMS_LIMIT_EXCEEDED',
        message: 'Limitiniz bitib, artırmaq üçün adminlə əlaqə saxlayın',
      });
    }

    // Send SMS and write logs. sms_used is already reserved above.
    for (const s of studentsWithPhones) {
      const raw = await sendRawSms(s.phone, msg);
      const interpreted = interpretSendRawSms(raw);
      const statusStr = interpreted.ok ? String(interpreted.status || 'sent') : `failed:${interpreted.reason || 'unknown'}`;

      try {
        await db.query(
          `INSERT INTO sms_logs (instructor_id, phone, message, status, http_status, msisdn, provider)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [instructorId, s.phone, msg, statusStr, raw?.httpStatus ?? null, raw?.msisdn ?? null, raw?.json ?? null],
        );
      } catch {
        await db.query(
          `INSERT INTO sms_logs (instructor_id, phone, message, status)
           VALUES ($1, $2, $3, $4)`,
          [instructorId, s.phone, msg, statusStr],
        );
      }
    }

    return res.json({ success: true, method: 'sms', sent: count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAdminNotifications,
  getInstructorNotifications,
  getInstructorSmsHistory,
  getStudentNotifications,
  quickInstructorNotification,
};
