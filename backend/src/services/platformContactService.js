const { getSetting, setSetting } = require('./billingSettingsService');

const SETTING_KEY = 'public_whatsapp_msisdn';
const DEFAULT_MSISDN = '994553775770';

function normalizeMsisdn(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) d = `994${d.slice(1)}`;
  else if (!d.startsWith('994') && d.length === 9) d = `994${d}`;
  return d;
}

function formatPhoneDisplay(msisdn) {
  const d = normalizeMsisdn(msisdn);
  if (d.length < 12) return d ? `+${d}` : '';
  return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
}

function buildWhatsAppUrl(msisdn) {
  const d = normalizeMsisdn(msisdn);
  return d ? `https://wa.me/${d}` : `https://wa.me/${DEFAULT_MSISDN}`;
}

async function resolveMsisdn() {
  const raw = await getSetting(SETTING_KEY);
  const d = normalizeMsisdn(raw);
  return d.length >= 12 ? d : DEFAULT_MSISDN;
}

async function getPublicPlatformContact() {
  const whatsapp_msisdn = await resolveMsisdn();
  return {
    whatsapp_msisdn,
    whatsapp_url: buildWhatsAppUrl(whatsapp_msisdn),
    phone_display: formatPhoneDisplay(whatsapp_msisdn),
  };
}

async function adminGetPlatformContact() {
  const stored = await getSetting(SETTING_KEY);
  const contact = await getPublicPlatformContact();
  return {
    whatsapp_phone: formatPhoneDisplay(contact.whatsapp_msisdn),
    whatsapp_msisdn: contact.whatsapp_msisdn,
    whatsapp_url: contact.whatsapp_url,
    phone_display: contact.phone_display,
    is_default: !stored || !normalizeMsisdn(stored),
    default_msisdn: DEFAULT_MSISDN,
  };
}

async function adminUpdatePlatformContact({ whatsapp_phone, whatsapp_msisdn }) {
  const raw = whatsapp_msisdn != null ? whatsapp_msisdn : whatsapp_phone;
  const d = normalizeMsisdn(raw);
  if (d.length < 12 || !d.startsWith('994')) {
    const err = new Error('Düzgün Azərbaycan mobil nömrəsi daxil edin (məs: +994553775770)');
    err.statusCode = 400;
    throw err;
  }
  await setSetting(SETTING_KEY, d);
  return adminGetPlatformContact();
}

module.exports = {
  DEFAULT_MSISDN,
  normalizeMsisdn,
  formatPhoneDisplay,
  buildWhatsAppUrl,
  getPublicPlatformContact,
  adminGetPlatformContact,
  adminUpdatePlatformContact,
};
