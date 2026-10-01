/**
 * Shared email sender: every outgoing email goes through `sendMail`.
 * - One provider config (emailConfig), Resend first then SMTP (stream `legacy_smtp`: SMTP first).
 * - Dry-run gate per stream: logs masked recipient + template + locale only. Never the subject,
 *   body, links or tokens.
 * - Errors are reduced to a safe code + short message (no addresses, no provider payloads).
 */
const nodemailer = require('nodemailer');
const { getEmailConfig, streamMode, providerOrder } = require('./emailConfig');

const STREAMS = new Set(['transactional', 'notification', 'legacy_smtp']);

function maskEmail(addr) {
  const s = String(addr || '').trim();
  const at = s.lastIndexOf('@');
  if (at < 1) return s ? '***' : '';
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const tld = dot > 0 ? domain.slice(dot) : '';
  return `${local[0]}***@${domain[0] || ''}***${tld}`;
}

function isValidAddress(addr) {
  const s = String(addr || '').trim();
  return s.length <= 320 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);
}

function safeMessage(msg) {
  return String(msg || '')
    .replace(/[^\s@<>"']+@[^\s@<>"']+/g, '[email]')
    .replace(/https?:\/\/\S+/g, '[url]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/** Resend `{ name, statusCode, message }` or SMTP/network Error → { code, transient, message }. */
function classifyError(err) {
  const status = Number(err?.statusCode ?? err?.responseCode ?? NaN);
  const name = String(err?.name || err?.code || '').toLowerCase();
  const message = safeMessage(err?.message || err);
  if (/domain is not verified|not verified/i.test(err?.message || '')) {
    return { code: 'sender_not_verified', transient: false, message };
  }
  if (status === 429 || name.includes('rate_limit')) return { code: 'rate_limited', transient: true, message };
  if (Number.isFinite(status) && status >= 500) return { code: 'provider_unavailable', transient: true, message };
  if (Number.isFinite(status) && status >= 400) {
    return { code: name.replace(/[^a-z0-9_]/g, '_').slice(0, 50) || 'rejected', transient: false, message };
  }
  if (name === 'timeout' || /timed? ?out|vaxtı bitdi/i.test(err?.message || '')) {
    return { code: 'timeout', transient: true, message };
  }
  if (/^e[a-z]+$/.test(name) || name.includes('application_error') || name.includes('internal')) {
    return { code: 'network_error', transient: true, message };
  }
  return { code: 'send_error', transient: true, message };
}

function logDryRun({ stream, templateKey, locale, to, ref }) {
  console.log(
    `[email:dry_run] stream=${stream} template=${templateKey || 'unknown'} locale=${locale || '-'} to=${maskEmail(to)}${
      ref ? ` ref=${ref}` : ''
    }`,
  );
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('Email send timed out'), { name: 'timeout' })), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

let smtpTransportCache = null;
let resendCtor = null;

const defaultProviders = {
  async resend(cfg, msg, opts) {
    if (!resendCtor) resendCtor = require('resend').Resend;
    const client = new resendCtor(cfg.resend.apiKey);
    const payload = {
      from: msg.from || cfg.from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    };
    const replyTo = msg.replyTo || cfg.replyTo;
    if (replyTo) payload.replyTo = replyTo;
    if (msg.attachments?.length) payload.attachments = msg.attachments;
    const sendOpts = opts.idempotencyKey ? { idempotencyKey: String(opts.idempotencyKey).slice(0, 256) } : undefined;
    const { data, error } = await client.emails.send(payload, sendOpts);
    if (error) throw Object.assign(new Error(error.message || 'Resend error'), error);
    return { messageId: data?.id || null };
  },
  async smtp(cfg, msg) {
    if (!smtpTransportCache) {
      smtpTransportCache = nodemailer.createTransport({
        host: cfg.smtp.host,
        port: cfg.smtp.port,
        secure: cfg.smtp.secure,
        auth: { user: cfg.smtp.user, pass: cfg.smtp.pass },
      });
    }
    const info = await smtpTransportCache.sendMail({
      from: msg.smtpFrom || cfg.smtp.from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      replyTo: msg.replyTo || cfg.replyTo || undefined,
      attachments: msg.attachments,
    });
    return { messageId: info?.messageId || null };
  },
};

let providers = defaultProviders;

/** Tests only: replace real providers with fakes (never hit the network in tests). */
function __setProvidersForTests(fake) {
  providers = fake ? { ...fake } : defaultProviders;
}

/**
 * @param {object} msg
 * @param {'transactional'|'notification'|'legacy_smtp'} msg.stream
 * @param {string} msg.to
 * @param {string} msg.subject
 * @param {string} [msg.text]
 * @param {string} [msg.html]
 * @param {string} [msg.templateKey]   for logs/metrics only
 * @param {string} [msg.locale]
 * @param {string} [msg.from]          per-sender override (e.g. INSTRUCTOR_COMPLETE_PROFILE_FROM)
 * @param {Array}  [msg.attachments]
 * @param {object} [opts]
 * @param {object} [opts.env]          defaults to process.env
 * @param {string} [opts.idempotencyKey]  provider-side dedupe for retried outbox rows
 * @param {string} [opts.ref]          short non-sensitive id for dry-run logs
 * @returns {Promise<{ ok: boolean, status: 'sent'|'dry_run'|'skipped'|'failed', provider?: string,
 *   messageId?: string|null, errorCode?: string, error?: string, transient?: boolean, skipped?: boolean,
 *   reason?: string, dryRun?: boolean }>}
 */
async function sendMail(msg, opts = {}) {
  const stream = STREAMS.has(msg?.stream) ? msg.stream : 'transactional';
  const cfg = getEmailConfig(opts.env || process.env);
  const to = String(msg?.to || '').trim();

  if (!isValidAddress(to)) {
    return { ok: false, status: 'failed', errorCode: 'invalid_recipient', error: 'Invalid recipient', transient: false };
  }

  if (streamMode(cfg, stream) === 'dry_run') {
    logDryRun({ stream, templateKey: msg.templateKey, locale: msg.locale, to, ref: opts.ref });
    return { ok: false, status: 'dry_run', dryRun: true, skipped: true, reason: 'dry_run', provider: 'dry_run' };
  }

  const order = providerOrder(cfg, stream);
  if (!order.length) {
    return {
      ok: false,
      status: 'skipped',
      skipped: true,
      reason: 'email_not_configured',
      errorCode: 'provider_unavailable',
      error: 'No email provider configured',
      transient: false,
    };
  }

  let last = null;
  for (const name of order) {
    const impl = providers[name];
    if (typeof impl !== 'function') continue;
    try {
      const r = await withTimeout(Promise.resolve(impl(cfg, msg, opts)), cfg.sendTimeoutMs);
      return { ok: true, status: 'sent', provider: name, messageId: r?.messageId || null };
    } catch (err) {
      last = { provider: name, ...classifyError(err) };
      // Permanent rejection by the preferred provider (bad sender/recipient) is not retried elsewhere.
      if (!last.transient) break;
    }
  }
  return {
    ok: false,
    status: 'failed',
    provider: last?.provider,
    errorCode: last?.code || 'send_error',
    error: last?.message || 'Email send failed',
    transient: last ? last.transient : true,
  };
}

module.exports = { sendMail, maskEmail, isValidAddress, classifyError, safeMessage, __setProvidersForTests };
