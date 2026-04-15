const db = require('../utils/db');

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
    const { rows } = await db.query(
      `SELECT ip.sms_limit, ip.sms_used, ip.storage_limit_mb, ip.storage_used_mb,
              ip.ram_limit_mb, COALESCE(ip.ram_used_mb, 0) AS ram_used_mb,
              ip.usage_synced_at,
              ROUND((ip.sms_used::float / NULLIF(ip.sms_limit,0)) * 100) AS sms_percent,
              ROUND((ip.storage_used_mb::float / NULLIF(ip.storage_limit_mb,0)) * 100) AS storage_percent,
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

module.exports = { getAdminNotifications, getInstructorNotifications };
