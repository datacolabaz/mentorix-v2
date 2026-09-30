const db = require('../utils/db');
const { getBrand } = require('../config/brand');
const { getEmailConfig } = require('./email/emailConfig');
const { sendMail } = require('./email/emailTransport');

function smtpEnabled() {
  return getEmailConfig().smtp.configured;
}

/**
 * Legacy SMTP-first send (payment receipts, old queue rows). Goes through the shared
 * transport: SMTP when configured (as before), dry-run gate, masked logs.
 * Returns `{ skipped: true }` when nothing was sent (no provider or dry-run); throws on failure.
 */
async function sendEmail({ to, subject, text, html, attachments, from: fromOverride, templateKey }) {
  const r = await sendMail({
    stream: 'legacy_smtp',
    to,
    subject,
    text,
    html,
    attachments,
    templateKey: templateKey || 'legacy_smtp',
    from: fromOverride,
  });
  if (r.status === 'sent') return { skipped: false, messageId: r.messageId || null, provider: r.provider };
  if (r.status === 'dry_run' || r.status === 'skipped') return { skipped: true, reason: r.reason || r.status };
  throw Object.assign(new Error(r.error || 'Email send failed'), { code: r.errorCode });
}

async function userEmail(userId) {
  const { rows } = await db.query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [userId]);
  const e = rows[0]?.email ? String(rows[0].email).trim() : '';
  return e || null;
}

async function userEmailAndLocale(userId) {
  const { rows } = await db.query(`SELECT email, locale FROM users WHERE id = $1 LIMIT 1`, [userId]);
  const e = rows[0]?.email ? String(rows[0].email).trim() : '';
  return { email: e || null, locale: rows[0]?.locale || null };
}

async function sendPaymentEmail({ userId, plan, status, amountAzn, orderId }) {
  const to = await userEmail(userId);
  if (!to) return { skipped: true };
  const brand = getBrand().name;
  const subj =
    status === 'paid'
      ? `${brand} — Ödəniş təsdiqləndi (${String(plan || '').toUpperCase()})`
      : `${brand} — Ödəniş alınmadı`;
  const txt =
    status === 'paid'
      ? `Ödəniş uğurludur.\nPlan: ${plan}\nMəbləğ: ${amountAzn} AZN\nOrder: ${orderId || '—'}\n`
      : `Ödəniş alınmadı.\nPlan: ${plan}\nMəbləğ: ${amountAzn} AZN\nOrder: ${orderId || '—'}\nYenidən cəhd edin: panel → Upgrade.\n`;
  return await sendEmail({ to, subject: subj, text: txt, templateKey: `payment_${status === 'paid' ? 'paid' : 'failed'}` });
}

async function sendRenewalReminderEmail({ userId, daysLeft, periodEndIso }) {
  const to = await userEmail(userId);
  if (!to) return { skipped: true };
  const subj = `${getBrand().name} — Abunə bitir (${daysLeft} gün qalıb)`;
  const txt = `Abunənizin müddəti bitmək üzrədir.\nQalan gün: ${daysLeft}\nBitmə tarixi: ${periodEndIso}\nPanel → Upgrade/Ödəniş ilə yeniləyin.\n`;
  return await sendEmail({ to, subject: subj, text: txt, templateKey: 'renewal_reminder' });
}

module.exports = { smtpEnabled, sendEmail, userEmail, userEmailAndLocale, sendPaymentEmail, sendRenewalReminderEmail };
