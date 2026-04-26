const db = require('../utils/db');
const { recomputeInstructorUsage } = require('../services/resourceUsageService');
const { sendRawSms } = require('../services/smsService');

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
      const statusRaw = raw?.json?.response?.status ?? raw?.json?.status ?? null;
      const status = statusRaw != null ? String(statusRaw) : raw?.ok ? 'sent' : 'failed';

      await db.query(
        `INSERT INTO sms_logs (instructor_id, phone, message, status)
         VALUES ($1, $2, $3, $4)`,
        [instructorId, s.phone, msg, status || (raw?.ok ? 'sent' : 'failed')],
      );
    }

    return res.json({ success: true, method: 'sms', sent: count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAdminNotifications,
  getInstructorNotifications,
  getStudentNotifications,
  quickInstructorNotification,
};
