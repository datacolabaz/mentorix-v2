const db = require('../utils/db');
const { recomputeInstructorUsage } = require('../services/resourceUsageService');
const { logBillingEvent, resolveEntitlements } = require('../services/billingEntitlements');
const {
  storageUsageLine,
  pickLimitCta,
  isHighestTierPlan,
} = require('../services/billingAlertHelpers');
const {
  getDiscoverProfileCompleteness,
  buildDiscoverProfileAlert,
} = require('../services/discoverProfileCompletenessService');
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
        const stLine = storageUsageLine(used, lim);
        if (stLine && stLine.pct >= 80) {
          const cta = pickLimitCta({
            plan,
            plansMap,
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
      const stLine = storageUsageLine(used, lim);
      if (stLine && stLine.pct >= 80) {
        const highest = isHighestTierPlan(plan, plansMap);
        const cta =
          stLine.pct >= 100 && highest
            ? { label: 'Yaddaşı idarə et', action: 'OPEN_SETTINGS_STORAGE' }
            : pickLimitCta({
                plan,
                plansMap,
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

    const discoverCompleteness = await getDiscoverProfileCompleteness(req.user.id);
    const discoverAlert = buildDiscoverProfileAlert(discoverCompleteness);
    if (discoverAlert) alerts.unshift(discoverAlert);

    const stLimMb = lim.storage_mb ?? null;
    const stLimBytes = stLimMb != null ? Number(stLimMb) * 1024 * 1024 : null;
    const stUsedBytes = Number(used.storage_bytes ?? 0) || 0;
    const stUsedMb = stUsedBytes / (1024 * 1024);

    res.json({
      success: true,
      alerts,
      billing_messages: messages,
      pending_topup: pendingTopup,
      profile: {
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
      discover_profile: discoverCompleteness,
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

const { resolveEnrollmentScope } = require('../services/studentEnrollmentsService');

const ASSIGNMENT_NOTIF_TYPES = [
  'assignment_new',
  'assignment_reminder',
  'assignment_overdue',
  'assignment_reviewed',
  'assignment_submitted',
];

const getStudentNotificationSummary = async (req, res) => {
  try {
    const studentId = req.user.id;
    const enrollmentId = String(req.query.enrollment_id || '').trim() || null;
    const scope = enrollmentId ? await resolveEnrollmentScope(studentId, enrollmentId) : null;
    if (enrollmentId && !scope) {
      return res.status(404).json({ success: false, message: 'Qrup tapılmadı' });
    }

    const instructorId = scope?.instructor_id || null;
    const nParams = [studentId];
    let notifScopeSql = '';
    if (instructorId) {
      nParams.push(instructorId);
      const types = ASSIGNMENT_NOTIF_TYPES.map((t) => `'${t}'`).join(', ');
      notifScopeSql = ` AND (
         type NOT IN (${types})
         OR EXISTS (
           SELECT 1 FROM assignments asg
           WHERE asg.instructor_id = $${nParams.length}
             AND asg.id::text = COALESCE(meta->>'assignment_id', '')
         )
       )`;
    }

    const { rows: nrows } = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE is_read = FALSE)::int AS unread_count,
         COUNT(*) FILTER (
           WHERE is_read = FALSE AND type IN (${ASSIGNMENT_NOTIF_TYPES.map((t) => `'${t}'`).join(', ')})
         )::int AS unread_assignment_notifications
       FROM notifications
       WHERE user_id = $1${notifScopeSql}`,
      nParams,
    );

    const tParams = [studentId];
    let taskScopeSql = '';
    if (instructorId) {
      tParams.push(instructorId);
      taskScopeSql = ` AND t.instructor_id = $${tParams.length}`;
    }
    const { rows: trows } = await db.query(
      `SELECT
         COUNT(*) FILTER (
           WHERE a.status IN ('pending', 'late') AND a.submitted_at IS NULL
         )::int AS pending_assignments,
         COUNT(*) FILTER (
           WHERE a.status IN ('pending', 'late') AND a.submitted_at IS NULL AND a.seen_at IS NULL
         )::int AS unseen_assignments
       FROM student_assignments a
       JOIN assignments t ON t.id = a.assignment_id
       WHERE a.student_id = $1${taskScopeSql}`,
      tParams,
    );
    res.json({
      success: true,
      summary: {
        unread_notifications: Number(nrows[0]?.unread_count) || 0,
        unread_assignment_notifications: Number(nrows[0]?.unread_assignment_notifications) || 0,
        pending_assignments: Number(trows[0]?.pending_assignments) || 0,
        unseen_assignments: Number(trows[0]?.unseen_assignments) || 0,
        enrollment_id: scope?.enrollment_id || null,
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
      `UPDATE notifications SET is_read = TRUE, read_at = COALESCE(read_at, NOW()) WHERE id = $1 AND user_id = $2`,
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
    await db.query(`UPDATE notifications SET is_read = TRUE, read_at = COALESCE(read_at, NOW()) WHERE user_id = $1 AND is_read = FALSE`, [
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
    if (rawMethod === 'sms') {
      return res.status(410).json({
        success: false,
        code: 'SMS_RETIRED',
        message: 'SMS bildirişləri dayandırılıb. Bildiriş platforma daxilində və e-poçtla göndərilir.',
      });
    }
    const safeMethod = rawMethod === 'whatsapp' ? 'whatsapp' : 'internal';
    const title = 'Sürətli Bildiriş';

    if (safeMethod === 'internal') {
      const { createNotificationSafe } = require('../services/notificationService');
      const batchId = require('crypto').randomUUID();
      let sent = 0;
      for (const studentId of allowedIds) {
        const out = await createNotificationSafe({
          recipientId: studentId,
          category: 'group',
          eventType: 'instructor_panel',
          title,
          body: msg,
          meta: { batch_id: batchId },
          actorUserId: instructorId,
          providerWorkspaceId: instructorId,
          dedupeKey: `instructor_panel:${batchId}`,
          email: false,
        });
        if (out.created) sent += 1;
      }
      return res.json({ success: true, method: 'internal', sent });
    }

    // WhatsApp (the only phone channel left; SMS retired).
    const { getInstructorPhoneVerificationBlock } = require('../utils/instructorPhone');
    const block = await getInstructorPhoneVerificationBlock(db, instructorId);
    if (block) return res.status(block.statusCode).json(block.body);

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

    if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
      return res.status(503).json({
        success: false,
        message:
          'WhatsApp API konfiqurasiya olunmayıb (WHATSAPP_ACCESS_TOKEN və WHATSAPP_PHONE_NUMBER_ID).',
      });
    }

    const { sendStudentWhatsApp } = require('../services/studentMessagingService');
    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const s of studentsWithPhones) {
      const r = await sendStudentWhatsApp({
        instructorId,
        studentId: s.id,
        phone: s.phone,
        message: msg,
        logType: 'instructor_whatsapp',
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
