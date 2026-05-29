const db = require('../utils/db');

const BANK_CARD_DIGITS = 16;
const DEFAULT_ACCOUNT = '0000000000000000';
const DEFAULT_SMS_PACKS = [
  { quantity: 50, price_azn: 10, label: '50 SMS' },
  { quantity: 100, price_azn: 18, label: '100 SMS' },
  { quantity: 200, price_azn: 32, label: '200 SMS' },
];

const DEFAULT_STORAGE_PACKS = [
  { quantity_mb: 5, price_azn: 5, label: '+5 MB yaddaş' },
  { quantity_mb: 10, price_azn: 9, label: '+10 MB yaddaş' },
  { quantity_mb: 20, price_azn: 16, label: '+20 MB yaddaş' },
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
  return raw.slice(0, BANK_CARD_DIGITS);
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

async function getStoragePacks() {
  try {
    const raw = await getSetting('storage_packs');
    const parsed = raw ? JSON.parse(raw) : DEFAULT_STORAGE_PACKS;
    if (!Array.isArray(parsed)) return DEFAULT_STORAGE_PACKS;
    return parsed
      .map((p) => ({
        quantity_mb: Math.max(1, Math.round(Number(p.quantity_mb ?? p.quantity) || 0)),
        price_azn: Math.max(0, Number(p.price_azn) || 0),
        label: String(p.label || `+${p.quantity_mb} MB yaddaş`).trim(),
      }))
      .filter((p) => p.quantity_mb > 0 && p.price_azn > 0);
  } catch {
    return DEFAULT_STORAGE_PACKS;
  }
}

function findStoragePack(packs, quantityMb) {
  const q = Math.round(Number(quantityMb) || 0);
  return packs.find((p) => p.quantity_mb === q) || null;
}

async function getOperatorInventoryFromSettings() {
  const read = async (key, fallback) => {
    const raw = await getSetting(key);
    if (raw == null || raw === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
  };
  const isSet = async (key) => {
    const raw = await getSetting(key);
    return raw != null && String(raw).trim() !== '';
  };
  const [
    operator_sms_stock_total,
    operator_sms_stock_remaining,
    operator_sms_low_alert,
    operator_storage_mb_total,
    operator_storage_mb_remaining,
    operator_storage_mb_low_alert,
    hasSmsTotal,
    hasSmsRem,
    hasStTotal,
    hasStRem,
  ] = await Promise.all([
    read('operator_sms_stock_total', 0),
    read('operator_sms_stock_remaining', 0),
    read('operator_sms_low_alert', 500),
    read('operator_storage_mb_total', 0),
    read('operator_storage_mb_remaining', 0),
    read('operator_storage_mb_low_alert', 500),
    isSet('operator_sms_stock_total'),
    isSet('operator_sms_stock_remaining'),
    isSet('operator_storage_mb_total'),
    isSet('operator_storage_mb_remaining'),
  ]);
  const inventory_configured = hasSmsTotal || hasSmsRem || hasStTotal || hasStRem;
  return {
    operator_sms_stock_total,
    operator_sms_stock_remaining,
    operator_sms_low_alert,
    operator_storage_mb_total,
    operator_storage_mb_remaining,
    operator_storage_mb_low_alert,
    inventory_configured,
  };
}

async function getBillingConfig() {
  const [manual_transfer_account, sms_packs, storage_packs, operator] = await Promise.all([
    getManualTransferAccount(),
    getSmsPacks(),
    getStoragePacks(),
    getOperatorInventoryFromSettings(),
  ]);
  return { manual_transfer_account, sms_packs, storage_packs, ...operator };
}

async function adminGetBillingSettings() {
  return getBillingConfig();
}

async function adminUpdateBillingSettings({
  manual_transfer_account,
  sms_packs,
  storage_packs,
  operator_sms_stock_total,
  operator_sms_stock_remaining,
  operator_sms_low_alert,
  operator_storage_mb_total,
  operator_storage_mb_remaining,
  operator_storage_mb_low_alert,
}) {
  if (manual_transfer_account != null) {
    const digits = String(manual_transfer_account).replace(/\D/g, '');
    if (digits.length !== BANK_CARD_DIGITS) {
      const err = new Error('Bank kartı nömrəsi 16 rəqəm olmalıdır');
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
  if (storage_packs != null) {
    if (!Array.isArray(storage_packs) || !storage_packs.length) {
      const err = new Error('storage_packs massivi tələb olunur');
      err.statusCode = 400;
      throw err;
    }
    await setSetting('storage_packs', JSON.stringify(storage_packs));
  }
  const opFields = [
    ['operator_sms_stock_total', operator_sms_stock_total],
    ['operator_sms_stock_remaining', operator_sms_stock_remaining],
    ['operator_sms_low_alert', operator_sms_low_alert],
    ['operator_storage_mb_total', operator_storage_mb_total],
    ['operator_storage_mb_remaining', operator_storage_mb_remaining],
    ['operator_storage_mb_low_alert', operator_storage_mb_low_alert],
  ];
  for (const [key, val] of opFields) {
    if (val == null || val === '') continue;
    const n = Math.max(0, Math.round(Number(val) || 0));
    await setSetting(key, String(n));
  }
  return getBillingConfig();
}

module.exports = {
  getSetting,
  getManualTransferAccount,
  getSmsPacks,
  findSmsPack,
  getStoragePacks,
  findStoragePack,
  getBillingConfig,
  adminGetBillingSettings,
  adminUpdateBillingSettings,
};
