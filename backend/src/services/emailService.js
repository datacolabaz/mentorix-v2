const nodemailer = require('nodemailer');
const db = require('../utils/db');

function smtpEnabled() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let cachedTransport = null;
function transport() {
  if (cachedTransport) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return cachedTransport;
}

async function sendEmail({ to, subject, text, html, attachments }) {
  if (!smtpEnabled()) return { skipped: true };
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const info = await transport().sendMail({
    from,
    to,
    subject,
    text,
    html,
    attachments,
  });
  return { skipped: false, messageId: info?.messageId || null };
}

async function userEmail(userId) {
  const { rows } = await db.query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [userId]);
  const e = rows[0]?.email ? String(rows[0].email).trim() : '';
  return e || null;
}

async function sendPaymentEmail({ userId, plan, status, amountAzn, orderId }) {
  const to = await userEmail(userId);
  if (!to) return { skipped: true };
  const subj =
    status === 'paid'
      ? `Mentorix — Ödəniş təsdiqləndi (${String(plan || '').toUpperCase()})`
      : `Mentorix — Ödəniş alınmadı`;
  const txt =
    status === 'paid'
      ? `Ödəniş uğurludur.\nPlan: ${plan}\nMəbləğ: ${amountAzn} AZN\nOrder: ${orderId || '—'}\n`
      : `Ödəniş alınmadı.\nPlan: ${plan}\nMəbləğ: ${amountAzn} AZN\nOrder: ${orderId || '—'}\nYenidən cəhd edin: panel → Upgrade.\n`;
  return await sendEmail({ to, subject: subj, text: txt });
}

async function sendRenewalReminderEmail({ userId, daysLeft, periodEndIso }) {
  const to = await userEmail(userId);
  if (!to) return { skipped: true };
  const subj = `Mentorix — Abunə bitir (${daysLeft} gün qalıb)`;
  const txt = `Abunənizin müddəti bitmək üzrədir.\nQalan gün: ${daysLeft}\nBitmə tarixi: ${periodEndIso}\nPanel → Upgrade/Ödəniş ilə yeniləyin.\n`;
  return await sendEmail({ to, subject: subj, text: txt });
}

module.exports = { smtpEnabled, sendEmail, userEmail, sendPaymentEmail, sendRenewalReminderEmail };

