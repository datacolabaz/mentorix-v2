const db = require('../utils/db');
const { sendSms } = require('./smsService');
const { sendWhatsAppOutbound } = require('./whatsappService');

function pickStudentNotifyPhone(row) {
  const st = row?.phone && String(row.phone).replace(/\D/g, '').length >= 9 ? row.phone : '';
  const par =
    row?.parent_phone && String(row.parent_phone).replace(/\D/g, '').length >= 9 ? row.parent_phone : '';
  return st || par || null;
}

async function logOutboundMessage({ instructorId, studentId, phone, message, status, channel, logType }) {
  const safeStatus = String(status || 'unknown').slice(0, 20);
  const ch = channel === 'whatsapp' ? 'whatsapp' : 'sms';
  try {
    await db.query(
      `INSERT INTO sms_logs (instructor_id, student_id, phone, message, status, type, package_type, sent_at, delivered_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),CASE WHEN $5 = 'sent' THEN NOW() ELSE NULL END)`,
      [instructorId, studentId || null, phone, message, safeStatus, logType || 'notification', ch]
    );
  } catch {
    try {
      await db.query(
        `INSERT INTO sms_logs (instructor_id, student_id, phone, message, status)
         VALUES ($1,$2,$3,$4,$5)`,
        [instructorId, studentId || null, phone, message, safeStatus]
      );
    } catch {
      // optional table
    }
  }
}

/**
 * Tələbə/valideyn nömrəsinə: əvvəl WhatsApp (konfiq varsa), uğursuzdursa SMS.
 */
async function sendStudentWhatsAppOrSms({
  instructorId,
  studentId,
  phone,
  message,
  logType = 'notification',
  whatsappOnly = false,
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
      await logOutboundMessage({
        instructorId,
        studentId,
        phone,
        message,
        status: 'whatsapp',
        channel: 'whatsapp',
        logType,
      });
    }
    return { ...wa, channel: 'whatsapp' };
  }

  if (whatsappOnly) {
    return {
      success: false,
      channel: 'whatsapp',
      error: wa.skipped ? 'whatsapp_not_configured' : wa.error || 'whatsapp_failed',
      whatsapp_skipped: Boolean(wa.skipped),
    };
  }

  const sms = await sendSms({ instructorId, phone, message, logType, studentId });

  return {
    ...sms,
    channel: 'sms',
    whatsapp_skipped: Boolean(wa.skipped),
    whatsapp_error: wa.skipped ? null : wa.error || null,
  };
}

module.exports = { sendStudentWhatsAppOrSms, pickStudentNotifyPhone };
