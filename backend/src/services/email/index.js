const { sendMail } = require('./emailTransport');
const { renderEmail } = require('./emailTemplates');

/**
 * Render a registered template and send it through the shared transport.
 * Result keeps the legacy shape callers already check: `{ ok, provider, messageId }` on success,
 * `{ ok: false, skipped: true, reason }` for dry-run / no provider, `{ ok: false, error }` on failure.
 */
async function sendTemplatedEmail(
  { stream = 'transactional', to, templateKey, locale, params, from, attachments },
  opts = {},
) {
  const email = renderEmail(templateKey, locale, params, { env: opts.env });
  const r = await sendMail(
    {
      stream,
      to,
      subject: email.subject,
      text: email.text,
      html: email.html,
      templateKey,
      locale: email.locale,
      from,
      attachments,
    },
    opts,
  );
  return { ...r, subject: email.subject, locale: email.locale };
}

module.exports = { sendTemplatedEmail };
