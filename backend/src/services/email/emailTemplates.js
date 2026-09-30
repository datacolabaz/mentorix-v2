/**
 * Email template registry: `renderEmail(key, locale, params)` → { subject, text, html }.
 * Locales: az (default), en, ru; tr/de fall back to en like the frontend.
 * Brand name and links come from config (config/brand.js, emailConfig), never hard-coded.
 */
const { getBrand } = require('../../config/brand');
const { appLink } = require('./emailConfig');
const { renderLayout } = require('./emailLayout');
const { formatDateTime, formatDateOnly } = require('../../utils/formatDateTime');
const notification = require('./templates/notificationEmails');
const transactional = require('./templates/transactionalEmails');

const SUPPORTED = ['az', 'en', 'ru'];
const GENERIC_NOTIFICATION_KEY = 'notification_generic';

function emailLocale(raw) {
  const l = String(raw || '').trim().toLowerCase().split(/[-_]/)[0];
  if (SUPPORTED.includes(l)) return l;
  if (l === 'tr' || l === 'de') return 'en';
  return 'az';
}

function templateKind(key) {
  if (Object.prototype.hasOwnProperty.call(notification.TEMPLATES, key)) return 'notification';
  if (Object.prototype.hasOwnProperty.call(transactional.TEMPLATES, key)) return 'transactional';
  return null;
}

function hasEmailTemplate(key) {
  return templateKind(key) != null;
}

/** Notification event types without their own email copy use the generic template. */
function notificationTemplateKey(eventType) {
  return templateKind(eventType) === 'notification' ? eventType : GENERIC_NOTIFICATION_KEY;
}

function buildCtx(locale, env) {
  return {
    brand: getBrand(),
    locale,
    link: (path) => appLink(path, env),
    fmt: (v) => formatDateTime(v, locale),
    fmtDate: (v) => formatDateOnly(v, locale),
  };
}

/**
 * @param {string} key       template key (notification event type or transactional key)
 * @param {string} locale    users.locale or similar; normalised here
 * @param {object} params    plain values (escaped by the layout)
 * @param {object} [opts]
 * @param {string} [opts.ctaUrl]   notification emails: absolute deep link
 * @param {object} [opts.env]
 */
function renderEmail(key, locale, params = {}, opts = {}) {
  const kind = templateKind(key);
  if (!kind) throw Object.assign(new Error(`unknown email template: ${key}`), { code: 'UNKNOWN_TEMPLATE' });
  const lang = emailLocale(locale);
  const ctx = buildCtx(lang, opts.env);
  const group = kind === 'notification' ? notification.TEMPLATES : transactional.TEMPLATES;
  const fn = group[key][lang] || group[key].az;
  const spec = fn(params || {}, ctx);

  let cta = spec.cta || null;
  let footer = spec.footer || [];
  let linkHint = null;
  if (kind === 'notification') {
    cta = opts.ctaUrl ? { label: spec.ctaLabel, url: opts.ctaUrl } : null;
    footer = notification.FOOTER[lang](ctx);
    linkHint = notification.LINK_HINT[lang];
  }

  const { html, text } = renderLayout({
    brandName: ctx.brand.name,
    lang,
    eyebrow: spec.eyebrow,
    heading: spec.heading,
    paragraphs: spec.paragraphs,
    code: spec.code,
    cta,
    linkHint,
    footer,
  });
  const subject = String(spec.subject || ctx.brand.name).replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
  return { templateKey: key, locale: lang, subject, text, html };
}

function listTemplates() {
  return {
    notification: Object.keys(notification.TEMPLATES),
    transactional: Object.keys(transactional.TEMPLATES),
  };
}

module.exports = {
  renderEmail,
  emailLocale,
  hasEmailTemplate,
  notificationTemplateKey,
  listTemplates,
  GENERIC_NOTIFICATION_KEY,
  SUPPORTED_EMAIL_LOCALES: SUPPORTED,
};
