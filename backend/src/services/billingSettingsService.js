const db = require('../utils/db');

const DEFAULT_ACCOUNT = '000000000000';
const DEFAULT_SMS_PACKS = [
  { quantity: 50, price_azn: 10, label: '50 SMS' },
  { quantity: 100, price_azn: 18, label: '100 SMS' },
  { quantity: 200, price_azn: 32, label: '200 SMS' },
];

async function getSetting(key) {
  const { rows } = await db.query(`SELECT value FROM billing_settings WHERE key = $1 LIMIT 1`, [key]);
  return rows[0]?.value ?? null;
}

async function setSetting(key, value) {
  await db.query(
    `INSERT INTO billing_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, String(value)]
  );
}

async function getManualTransferAccount() {
  const raw = String((await getSetting('manual_transfer_account')) || DEFAULT_ACCOUNT).replace(/\D/g, '');
  return raw.padStart(12, '0').slice(-12);
}

async function getSmsPacks() {
  try {
    const raw = await getSetting('sms_packs');
    const parsed = raw ? JSON.parse(raw) : DEFAULT_SMS_PACKS;
    if (!Array.isArray(parsed)) return DEFAULT_SMS_PACKS;
    return parsed
      .map((p) => ({
        quantity: Math.max(1, Math.round(Number(p.quantity) || 0)),
        price_azn: Math.max(0, Number(p.price_azn) || 0),
        label: String(p.label || `${p.quantity} SMS`).trim(),
      }))
      .filter((p) => p.quantity > 0 && p.price_azn > 0);
  } catch {
    return DEFAULT_SMS_PACKS;
  }
}

function findSmsPack(packs, quantity) {
  const q = Math.round(Number(quantity) || 0);
  return packs.find((p) => p.quantity === q) || null;
}

async function getBillingConfig() {
  const [manual_transfer_account, sms_packs] = await Promise.all([getManualTransferAccount(), getSmsPacks()]);
  return { manual_transfer_account, sms_packs };
}

async function adminGetBillingSettings() {
  return getBillingConfig();
}

async function adminUpdateBillingSettings({ manual_transfer_account, sms_packs }) {
  if (manual_transfer_account != null) {
    const digits = String(manual_transfer_account).replace(/\D/g, '');
    if (digits.length !== 12) {
      const err = new Error('Köçürmə hesabı 12 rəqəm olmalıdır');
      err.statusCode = 400;
      throw err;
    }
    await setSetting('manual_transfer_account', digits);
  }
  if (sms_packs != null) {
    if (!Array.isArray(sms_packs) || !sms_packs.length) {
      const err = new Error('sms_packs massivi tələb olunur');
      err.statusCode = 400;
      throw err;
    }
    await setSetting('sms_packs', JSON.stringify(sms_packs));
  }
  return getBillingConfig();
}

module.exports = {
  getManualTransferAccount,
  getSmsPacks,
  findSmsPack,
  getBillingConfig,
  adminGetBillingSettings,
  adminUpdateBillingSettings,
};
