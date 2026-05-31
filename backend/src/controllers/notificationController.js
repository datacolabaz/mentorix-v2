const db = require('../utils/db');
const { recomputeInstructorUsage } = require('../services/resourceUsageService');
const { sendRawSms } = require('../services/smsService');
const { ensureSmsPeriodUpToDate, logBillingEvent, resolveEntitlements, bumpUsageCountersTx } = require('../services/billingEntitlements');
const {
  smsUsageLine,
  storageUsageLine,
  pickLimitCta,
  isHighestTierPlan,
} = require('../services/billingAlertHelpers');
const { getActivePlansMap } = require('../services/subscriptionPlansService');

const getAdminNotifications = async (req, res) => {
  try {
    // NOTE: plan-driven limits (subscriptions + subscription_plans) are source of truth.
    // For admin list we compute alerts from usage_counters + entitlements limits.
    const { rows } = await db.query(
      `SELECT u.id, u.full_name, u.email
       FROM users u
       WHERE u.role = 'instructor' AND u.is_active = TRUE
       ORDER BY u.full_name`
    );

    const out = [];
    for (const r of rows) {
      try {
        const ent = await resolveEntitlements(r.id);
        const lim = ent?.limits || {};
        const used = ent?.usage || {};

        const plansMap = await getActivePlansMap();
        const plan = ent?.plan || 'basic';
        const alerts = [];
        const smsLine = smsUsageLine(used.sms_monthly, lim);
        if (smsLine && smsLine.pct >= 80) {
          const cta = pickLimitCta({
            plan,
            plansMap,
            reachedSms: smsLine.pct >= 100,
            reachedStorage: false,
            reachedStudents: false,
          });
          alerts.push({
            type: 'sms',
            message: smsLine.pct >= 100 ? smsLine.message : smsLine.warnMessage,
            level: smsLine.pct >= 100 ? 'critical' : 'warning',
            cta,
          });
        }

        const stLine = storageUsageLine(used, lim);
        if (stLine && stLine.pct >= 80) {
          const cta = pickLimitCta({
            plan,
            plansMap,
            reachedSms: false,
            reachedStorage: stLine.pct >= 100,
            reachedStudents: false,
          });
          alerts.push({
            type: 'storage',
            message: stLine.pct >= 100 ? stLine.message : stLine.warnMessage,
            level: stLine.pct >= 100 ? 'critical' : 'warning',
            cta,
          });
        }

        if (alerts.length) {
          out.push({ instructor: { id: r.id, full_name: r.full_name, email: r.email }, alerts });
        }
      } catch {
        // skip
      }
    }

    res.json({ success: true, notifications: out });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getInstructorNotifications = async (req, res) => {
  try {
    // Sync usage on each refresh for real-time display.
    await recomputeInstructorUsage(req.user.id, { persist: true });
    const ent = await resolveEntitlements(req.user.id);
    const lim = ent?.limits || {};
    const used = ent?.usage || {};

    const plansMap = await getActivePlansMap();
    const plan = ent?.plan || 'basic';
    const pendingTopup = ent?.pending_topup || null;
    const messages = ent?.messages || null;
    const alerts = [];

    if (messages?.suppress_limit_bar) {
      /* InstructorLayout BillingBanner göstərir; təkrar qırmızı zolaq yox */
    } else {
      const smsLine = smsUsageLine(used.sms_monthly, lim);
      if (smsLine && smsLine.pct >= 80) {
        const highest = isHighestTierPlan(plan, plansMap);
        const cta =
          smsLine.pct >= 100 && highest
            ? { label: 'SMS Balansı Artır', action: 'OPEN_SMS_TOPUP' }
            : pickLimitCta({
                plan,
                plansMap,
                reachedSms: smsLine.pct >= 100,
                reachedStorage: false,
                reachedStudents: false,
              });
        alerts.push({
          type: 'sms',
          message:
            smsLine.pct >= 100 && highest
              ? 'Aylıq SMS limitinizə çatdınız. İstifadəyə davam etmək üçün əlavə SMS paketi əldə edə bilərsiniz.'
              : smsLine.pct >= 100
                ? smsLine.message
                : smsLine.warnMessage,
          level: smsLine.pct >= 100 ? 'critical' : 'warning',
          cta,
        });
      }

      const stLine = storageUsageLine(used, lim);
      if (stLine && stLine.pct >= 80) {
        const highest = isHighestTierPlan(plan, plansMap);
        const cta =
          stLine.pct >= 100 && highest
            ? { label: 'Yaddaşı idarə et', action: 'OPEN_SETTINGS_STORAGE' }
            : pickLimitCta({
                plan,
                plansMap,
                reachedSms: false,
                reachedStorage: stLine.pct >= 100,
                reachedStudents: false,
              });
        alerts.push({
          type: 'storage',
          message:
            stLine.pct >= 100 && highest
              ? 'Yaddaş limitiniz dolub. Yeni fayl yükləmək üçün əlavə yaddaş sahəsi alın və ya köhnə faylları silin.'
              : stLine.pct >= 100
                ? stLine.message
                : stLine.warnMessage,
          level: stLine.pct >= 100 ? 'critical' : 'warning',
          cta,
        });
      }
    }

    const smsLim = lim.sms_monthly;
    const smsUsed = Number(used.sms_monthly || 0) || 0;

    res.json({
      success: true,
      alerts,
      billing_messages: messages,
      pending_topup: pendingTopup,
      profile: {
        sms_limit: smsLim,
        sms_limit_plan: lim.sms_monthly_plan ?? null,
        sms_used_monthly: smsUsed,
        plan,
        storage_limit_mb: stLimMb,
        storage_limit_bytes: stLimBytes,
        storage_used_mb: stUsedMb,
        storage_used_bytes: stUsedBytes,
        plan: ent?.plan || null,
        status: ent?.status || null,
        whatsapp_configured: Boolean(
          process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
        ),
        whatsapp_production_style: Boolean(String(process.env.WHATSAPP_TEMPLATE_NAME || '').trim()),
        whatsapp_template_name: String(process.env.WHATSAPP_TEMPLATE_NAME || '').trim() || null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getStudentNotifications = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, title, body, type, is_read, created_at, COALESCE(meta, '{}'::jsonb) AS meta
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

const getStudentNotificationSummary = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { rows: nrows } = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE is_read = FALSE)::int AS unread_count,
         COUNT(*) FILTER (
           WHERE is_read = FALSE AND type IN ('assignment_new', 'assignment_reminder', 'assignment_overdue', 'assignment_reviewed', 'assignment_submitted')
         )::int AS unread_assignment_notifications
       FROM notifications
       WHERE user_id = $1`,
      [studentId],
    );
    const { rows: trows } = await db.query(
      `SELECT
         COUNT(*) FILTER (
           WHERE a.status IN ('pending', 'late') AND a.submitted_at IS NULL
         )::int AS pending_assignments,
         COUNT(*) FILTER (
           WHERE a.status IN ('pending', 'late') AND a.submitted_at IS NULL AND a.seen_at IS NULL
         )::int AS unseen_assignments
       FROM student_assignments a
       WHERE a.student_id = $1`,
      [studentId],
    );
    res.json({
      success: true,
      summary: {
        unread_notifications: Number(nrows[0]?.unread_count) || 0,
        unread_assignment_notifications: Number(nrows[0]?.unread_assignment_notifications) || 0,
        pending_assignments: Number(trows[0]?.pending_assignments) || 0,
        unseen_assignments: Number(trows[0]?.unseen_assignments) || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const markStudentNotificationRead = async (req, res) => {
  try {
    const id = req.params.id;
    const { rowCount } = await db.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
      [id, req.user.id],
    );
    if (!rowCount) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const markAllStudentNotificationsRead = async (req, res) => {
  try {
    await db.query(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`, [
      req.user.id,
    ]);
    res.json({ success: true });
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
      `SELECT u.id,
              COALESCE(NULLIF(TRIM(sp.phone_number), ''), NULLIF(TRIM(u.phone), '')) AS phone
       FROM users u
       JOIN enrollments e ON e.student_id = u.id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
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

    const rawMethod = String(method || 'internal').trim().toLowerCase();
    const safeMethod =
      rawMethod === 'sms' ? 'sms' : rawMethod === 'whatsapp' ? 'whatsapp' : 'internal';
    const title = 'Sürətli Bildiriş';

    if (safeMethod === 'internal') {
      await db.query(
        `INSERT INTO notifications (user_id, title, body, type, is_read)
         SELECT unnest($1::uuid[]), $2, $3, $4, FALSE`,
        [allowedIds, title, msg, 'instructor_panel'],
      );
      return res.json({ success: true, method: 'internal', sent: allowedIds.length });
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

    if (safeMethod === 'whatsapp') {
      if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
        return res.status(503).json({
          success: false,
          message:
            'WhatsApp API konfiqurasiya olunmayıb (WHATSAPP_ACCESS_TOKEN və WHATSAPP_PHONE_NUMBER_ID).',
        });
      }

      const { sendStudentWhatsAppOrSms } = require('../services/studentMessagingService');
      let sent = 0;
      let failed = 0;
      const errors = [];

      for (const s of studentsWithPhones) {
        const r = await sendStudentWhatsAppOrSms({
          instructorId,
          studentId: s.id,
          phone: s.phone,
          message: msg,
          logType: 'instructor_whatsapp',
          whatsappOnly: true,
        });
        if (r?.success) sent += 1;
        else {
          failed += 1;
          if (errors.length < 5) errors.push({ student_id: s.id, error: r?.error || 'failed' });
        }
      }

      if (!sent) {
        return res.status(502).json({
          success: false,
          message:
            'Heç bir tələbəyə WhatsApp göndərilmədi. Test rejimində recipient siyahısı və ya təsdiqlənmiş WHATSAPP_TEMPLATE_NAME şablonu lazımdır.',
          failed,
          errors,
        });
      }

      return res.json({
        success: true,
        method: 'whatsapp',
        sent,
        failed,
        ...(errors.length ? { errors } : {}),
      });
    }

    // SMS method (hard-enforced by usage_counters + entitlements; UI disable is not security).
    // Ensure monthly period source-of-truth is up to date (request-time, not cron).
    await ensureSmsPeriodUpToDate(db, instructorId).catch(() => {});

    const count = studentsWithPhones.length;

    const ent = await resolveEntitlements(instructorId);
    const smsLimit = ent?.limits?.sms_monthly; // null => unlimited
    const smsUsed = Number(ent?.usage?.sms_monthly || 0) || 0;
    if (smsLimit != null && smsUsed + count > Number(smsLimit)) {
      void logBillingEvent(db, {
        user_id: instructorId,
        event: 'limit_reached_sms',
        context: { used: smsUsed, add: count, limit: smsLimit, at: 'notifications.quick' },
      });
      return res.status(429).json({
        success: false,
        code: 'SMS_LIMIT',
        message: 'SMS limitinə çatdınız — davam etmək üçün daha geniş paket seçin.',
      });
    }

    // Reserve quota atomically in usage_counters to avoid concurrent overshoot.
    const reserved = await db.transaction(async (client) => {
      await ensureSmsPeriodUpToDate(client, instructorId);
      await client.query(`INSERT INTO usage_counters (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [
        instructorId,
      ]);
      if (smsLimit == null) {
        await bumpUsageCountersTx(client, instructorId, { sms_used_monthly: count });
        return true;
      }
      const { rows: r } = await client.query(
        `UPDATE usage_counters
         SET sms_used_monthly = sms_used_monthly + $2,
             updated_at = NOW()
         WHERE user_id = $1
           AND sms_used_monthly + $2 <= $3
         RETURNING sms_used_monthly`,
        [instructorId, count, Number(smsLimit)]
      );
      return r.length > 0;
    });

    if (!reserved) {
      void logBillingEvent(db, {
        user_id: instructorId,
        event: 'limit_reached_sms',
        context: { used: smsUsed, add: count, limit: smsLimit, at: 'notifications.quick.reserve' },
      });
      return res.status(429).json({
        success: false,
        code: 'SMS_LIMIT',
        message: 'SMS limitinə çatdınız — davam etmək üçün daha geniş paket seçin.',
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
  getStudentNotificationSummary,
  markStudentNotificationRead,
  markAllStudentNotificationsRead,
  quickInstructorNotification,
};
