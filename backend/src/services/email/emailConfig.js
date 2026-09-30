/**
 * The single place that reads email env vars. Spec names win over the legacy names that are
 * already set in Railway, so nothing has to change there (see PRECEDENCE below).
 *
 * Three sending streams share one provider config but have different safety gates:
 *   transactional — auth/account mails that already work in production (verification, password
 *                   reset, certificates, invites, ...). Live unless EMAIL_DRY_RUN=true or the
 *                   environment is explicitly non-production.
 *   notification  — emails produced by notificationService. Live ONLY when EMAIL_ENABLED=true,
 *                   EMAIL_DRY_RUN=false (explicit) and the environment is production.
 *                   EMAIL_ENABLED=true alone = queued + dry-run log. Unset = nothing queued.
 *   legacy_smtp   — old SMTP-only mails (queue rows, payment receipts). SMTP when configured,
 *                   as before; Resend only once notification sending is live.
 */
const { getBrand } = require('../../config/brand');

/** Documented precedence (first non-empty wins). Kept as data so tests and docs agree. */
const PRECEDENCE = Object.freeze({
  apiKey: ['EMAIL_PROVIDER_API_KEY', 'RESEND_API_KEY'],
  from: ['EMAIL_FROM', 'VERIFY_EMAIL_FROM'],
  replyTo: ['EMAIL_REPLY_TO'],
  frontendPublicUrl: ['FRONTEND_PUBLIC_URL', 'FRONTEND_BASE_URL', 'FRONTEND_URL', 'PUBLIC_APP_URL', 'APP_URL'],
  verificationBaseUrl: ['EMAIL_VERIFICATION_BASE_URL', 'FRONTEND_PUBLIC_URL', 'FRONTEND_BASE_URL', 'FRONTEND_URL'],
  environment: ['EMAIL_ENVIRONMENT', 'RAILWAY_ENVIRONMENT_NAME', 'RAILWAY_ENVIRONMENT', 'NODE_ENV'],
  smtpFrom: ['SMTP_FROM', 'SMTP_USER'],
});

const PRODUCTION_NAMES = new Set(['production', 'prod']);
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

function read(env, key) {
  const v = env[key];
  return v == null ? '' : String(v).trim();
}

function pick(env, keys) {
  for (const key of keys) {
    const v = read(env, key);
    if (v) return { value: v, source: key };
  }
  return { value: '', source: null };
}

/** true / false / null (unset or unrecognised). */
function tristate(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (TRUE_VALUES.has(s)) return true;
  if (FALSE_VALUES.has(s)) return false;
  return null;
}

function httpUrl(raw) {
  const s = String(raw || '').trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(s) ? s : '';
}

function pickUrl(env, keys) {
  for (const key of keys) {
    const v = httpUrl(read(env, key));
    if (v) return { value: v, source: key };
  }
  return { value: '', source: null };
}

function resolveEnvironment(env) {
  const hit = pick(env, PRECEDENCE.environment);
  const name = hit.value.toLowerCase();
  return {
    name: name || 'unknown',
    source: hit.source,
    isProduction: PRODUCTION_NAMES.has(name),
    explicitNonProduction: Boolean(name) && !PRODUCTION_NAMES.has(name),
  };
}

function getEmailConfig(env = process.env) {
  const brand = getBrand();
  const apiKey = pick(env, PRECEDENCE.apiKey);
  const from = pick(env, PRECEDENCE.from);
  const replyTo = pick(env, PRECEDENCE.replyTo);
  const url = pickUrl(env, PRECEDENCE.frontendPublicUrl);
  const verifyUrl = pickUrl(env, PRECEDENCE.verificationBaseUrl);
  const environment = resolveEnvironment(env);
  const enabled = tristate(read(env, 'EMAIL_ENABLED')) === true;
  const dryRunFlag = tristate(read(env, 'EMAIL_DRY_RUN'));
  const smtpHost = read(env, 'SMTP_HOST');
  const smtpUser = read(env, 'SMTP_USER');
  const smtpPass = read(env, 'SMTP_PASS');
  const defaultFrom = `${brand.name} <${brand.noreplyEmail || `notifications@${brand.domain}`}>`;
  const defaultUrl = `https://${brand.domain}`;

  return Object.freeze({
    brand,
    resend: Object.freeze({ apiKey: apiKey.value, apiKeySource: apiKey.source, configured: Boolean(apiKey.value) }),
    smtp: Object.freeze({
      configured: Boolean(smtpHost && smtpUser && smtpPass),
      host: smtpHost,
      port: Number(read(env, 'SMTP_PORT') || 587),
      secure: read(env, 'SMTP_SECURE').toLowerCase() === 'true',
      user: smtpUser,
      pass: smtpPass,
      from: pick(env, PRECEDENCE.smtpFrom).value,
    }),
    from: from.value || defaultFrom,
    fromSource: from.source || 'brand_default',
    replyTo: replyTo.value || null,
    frontendPublicUrl: url.value || defaultUrl,
    frontendPublicUrlSource: url.source || 'brand_default',
    verificationBaseUrl: verifyUrl.value || url.value || defaultUrl,
    environment,
    notificationsEnabled: enabled,
    dryRunFlag,
    sendTimeoutMs: Math.max(1000, Number(read(env, 'EMAIL_SEND_TIMEOUT_MS')) || 25000),
    conflicts: from.source === 'EMAIL_FROM' && read(env, 'VERIFY_EMAIL_FROM') && read(env, 'VERIFY_EMAIL_FROM') !== from.value
      ? ['EMAIL_FROM differs from VERIFY_EMAIL_FROM; EMAIL_FROM is used']
      : [],
  });
}

/** 'live' | 'dry_run' for auth/account mail that already works in production. */
function transactionalMode(cfg) {
  if (cfg.dryRunFlag === true) return 'dry_run';
  if (cfg.environment.explicitNonProduction) return 'dry_run';
  return 'live';
}

/**
 * 'off' | 'dry_run' | 'live' for notificationService emails.
 * off → nothing is queued (email_status = suppressed). Real sends need all three opt-ins.
 */
function notificationMode(cfg) {
  if (!cfg.notificationsEnabled) return 'off';
  if (cfg.dryRunFlag === false && cfg.environment.isProduction) return 'live';
  return 'dry_run';
}

function streamMode(cfg, stream) {
  if (stream === 'notification') {
    const m = notificationMode(cfg);
    return m === 'off' ? 'dry_run' : m;
  }
  return transactionalMode(cfg);
}

/** Provider order per stream; empty = nothing can deliver. */
function providerOrder(cfg, stream) {
  const out = [];
  if (stream === 'legacy_smtp') {
    if (cfg.smtp.configured) out.push('smtp');
    if (cfg.resend.configured && notificationMode(cfg) === 'live') out.push('resend');
    return out;
  }
  if (cfg.resend.configured) out.push('resend');
  if (cfg.smtp.configured) out.push('smtp');
  return out;
}

/** Frontend URL used in every email link (never the wrong `mentorix.az`). */
function frontendPublicUrl(env = process.env) {
  return getEmailConfig(env).frontendPublicUrl;
}

function appLink(path, env = process.env) {
  const p = String(path || '/');
  return `${frontendPublicUrl(env)}${p.startsWith('/') ? p : `/${p}`}`;
}

/** Boot log: no secrets, no addresses beyond the configured sender. */
function describeEmailConfig(env = process.env) {
  const cfg = getEmailConfig(env);
  return {
    environment: `${cfg.environment.name}${cfg.environment.source ? ` (${cfg.environment.source})` : ''}`,
    transactional: transactionalMode(cfg),
    notifications: notificationMode(cfg),
    providers: providerOrder(cfg, 'transactional').join(',') || 'none',
    resend_key_from: cfg.resend.apiKeySource || 'unset',
    from_source: cfg.fromSource,
    frontend_url: `${cfg.frontendPublicUrl} (${cfg.frontendPublicUrlSource})`,
    warnings: cfg.conflicts,
  };
}

module.exports = {
  PRECEDENCE,
  getEmailConfig,
  transactionalMode,
  notificationMode,
  streamMode,
  providerOrder,
  frontendPublicUrl,
  appLink,
  describeEmailConfig,
  tristate,
};
