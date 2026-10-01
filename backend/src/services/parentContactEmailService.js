/**
 * Parent result summary for the optional parent contact address (student_profiles.parent_email).
 * The linked parent account keeps its normal in-app + email notification; the contact address gets
 * a short email (student name + assessment title only) with a one-click unsubscribe link.
 * Same address as the parent account => only the account notification is sent.
 * The address and the unsubscribe token are never logged; the token is minted at send time.
 */
const db = require('../utils/db');

const EVENT_TYPE = 'parent_result_contact';

const normEmail = (v) => String(v || '').trim().toLowerCase();

/** @returns {{ account: boolean, contact: boolean }} */
function planParentResultDelivery({ parentAccountId, parentAccountEmail, parentEmail, parentEmailOptedOut }) {
  const account = Boolean(parentAccountId);
  const contactAddr = normEmail(parentEmail);
  const contact =
    Boolean(contactAddr) && !parentEmailOptedOut && !(account && contactAddr === normEmail(parentAccountEmail));
  return { account, contact };
}

async function queueParentContactResultEmail({ examId, studentId, instructorId, parentEmail, locale, params }) {
  const { enqueueNotification } = require('./notificationQueueService');
  await enqueueNotification({
    channel: 'email',
    event_type: EVENT_TYPE,
    unique_key: `${EVENT_TYPE}:${examId}:${studentId}`,
    user_id: null,
    instructor_id: instructorId || null,
    to_addr: normEmail(parentEmail),
    subject: null,
    body: EVENT_TYPE,
    context: {
      kind: 'parent_contact',
      student_id: String(studentId),
      exam_id: String(examId),
      locale: locale || 'az',
      params: { studentName: params.studentName, examTitle: params.examTitle },
    },
  });
}

function parseContext(ctx) {
  if (!ctx) return {};
  if (typeof ctx === 'object') return ctx;
  try {
    return JSON.parse(ctx);
  } catch {
    return {};
  }
}

const isParentContactRow = (row) => Boolean(row && row.channel === 'email' && row.event_type === EVENT_TYPE);

/**
 * Worker step for one queued parent-contact email. Re-checks the profile so a changed or
 * unsubscribed address is never mailed. Delivery goes through the "notification" stream, so it
 * follows EMAIL_ENABLED / EMAIL_DRY_RUN like every other notification email.
 */
async function processParentContactEmail(row, deps = {}) {
  const query = deps.query || ((sql, p) => db.query(sql, p));
  const { sendMail } = deps.sendMail ? { sendMail: deps.sendMail } : require('./email/emailTransport');
  const { renderEmail, emailLocale } = require('./email/emailTemplates');
  const { parentEmailUnsubscribeUrl } = require('./emailUnsubscribe');

  const ctx = parseContext(row.context);
  if (!ctx.student_id) return { kind: 'skipped', errorCode: 'entity_gone' };
  const { rows } = await query(
    `SELECT sp.parent_email, sp.parent_email_opt_out_at
     FROM student_profiles sp
     JOIN users u ON u.id = sp.user_id AND u.deleted_at IS NULL
     WHERE sp.user_id = $1::uuid
     LIMIT 1`,
    [ctx.student_id],
  );
  const current = rows[0];
  if (!current || !current.parent_email || normEmail(current.parent_email) !== normEmail(row.to_addr)) {
    return { kind: 'skipped', errorCode: 'recipient_changed' };
  }
  if (current.parent_email_opt_out_at) return { kind: 'suppressed', errorCode: 'unsubscribed' };

  const locale = emailLocale(ctx.locale);
  const email = renderEmail(EVENT_TYPE, locale, ctx.params || {}, {
    unsubscribeUrl: parentEmailUnsubscribeUrl(ctx.student_id, current.parent_email),
  });
  const r = await sendMail(
    {
      stream: 'notification',
      to: normEmail(current.parent_email),
      subject: email.subject,
      text: email.text,
      html: email.html,
      templateKey: EVENT_TYPE,
      locale,
    },
    { idempotencyKey: row.unique_key, ref: String(row.id || '').slice(0, 8) },
  );
  if (r.status === 'sent') return { kind: 'sent', provider: r.provider, messageId: r.messageId };
  if (r.status === 'dry_run') return { kind: 'dry_run', provider: 'dry_run' };
  if (r.status === 'skipped') {
    return { kind: 'skipped', errorCode: r.errorCode || 'provider_unavailable', errorMessageSafe: r.error };
  }
  return {
    kind: r.transient === false ? 'failed' : 'retry',
    transient: r.transient !== false,
    provider: r.provider,
    errorCode: r.errorCode || 'send_error',
  };
}

module.exports = {
  EVENT_TYPE,
  planParentResultDelivery,
  queueParentContactResultEmail,
  isParentContactRow,
  processParentContactEmail,
};
