const db = require('../utils/db');
const { sendWhatsAppOutbound } = require('./whatsappService');

function pickStudentNotifyPhone(row) {
  const st = row?.phone && String(row.phone).replace(/\D/g, '').length >= 9 ? row.phone : '';
  const par =
    row?.parent_phone && String(row.parent_phone).replace(/\D/g, '').length >= 9 ? row.parent_phone : '';
  return st || par || null;
}

/** WhatsApp outbound history (kept in the legacy sms_logs table, package_type = 'whatsapp'). */
async function logOutboundMessage({ instructorId, studentId, phone, message, status, logType }) {
  const safeStatus = String(status || 'unknown').slice(0, 20);
  try {
    await db.query(
      `INSERT INTO sms_logs (instructor_id, student_id, phone, message, status, type, package_type, sent_at, delivered_at)
       VALUES ($1,$2,$3,$4,$5,$6,'whatsapp',NOW(),CASE WHEN $5 = 'sent' THEN NOW() ELSE NULL END)`,
      [instructorId, studentId || null, phone, message, safeStatus, logType || 'notification']
    );
  } catch {
    // optional table
  }
}

/**
 * Teacher-initiated WhatsApp message to a student/parent number (configured WhatsApp Cloud API only).
 * There is no SMS fallback: SMS is retired.
 */
async function sendStudentWhatsApp({
  instructorId,
  studentId,
  phone,
  message,
  logType = 'notification',
  templateBodyParams = null,
  templateNameOverride = null,
}) {
  if (!phone || !String(message || '').trim()) {
    return { success: false, error: 'phone_or_message_missing' };
  }

  const wa = await sendWhatsAppOutbound({
    phone,
    message,
    templateBodyParams,
    templateNameOverride,
  });
  if (wa.success) {
    if (instructorId) {
      await logOutboundMessage({ instructorId, studentId, phone, message, status: 'whatsapp', logType });
    }
    return { ...wa, channel: 'whatsapp' };
  }

  return {
    success: false,
    channel: 'whatsapp',
    error: wa.skipped ? 'whatsapp_not_configured' : wa.error || 'whatsapp_failed',
    whatsapp_skipped: Boolean(wa.skipped),
  };
}

module.exports = { sendStudentWhatsApp, pickStudentNotifyPhone };
