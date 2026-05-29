const { fetchSmsProviderBalance } = require('./smsService');
const { getPlatformUploadsStorageStats } = require('./resourceUsageService');
const { adminUpdateBillingSettings } = require('./billingSettingsService');

function platformStorageTotalMb() {
  const n = Number(process.env.PLATFORM_STORAGE_TOTAL_MB);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function buildInventoryDisplay(operator, usage, live) {
  const hasManualSmsTotal = Boolean(operator?.has_sms_total);
  const hasManualSmsRem = Boolean(operator?.has_sms_remaining);
  const hasManualStTotal = Boolean(operator?.has_storage_total);
  const hasManualStRem = Boolean(operator?.has_storage_remaining);

  const providerBalance = live.sms.ok ? live.sms.balance : null;
  const diskUsedMb = live.storage.storage_used_mb ?? 0;
  const dbUsedMb = usage?.storage_used_mb ?? 0;
  const storageUsedMb = Math.max(diskUsedMb, dbUsedMb);
  const envTotalMb = live.storage.env_total_mb || 0;

  let sms_remaining = hasManualSmsRem ? operator.operator_sms_stock_remaining : providerBalance;
  let sms_total = hasManualSmsTotal
    ? operator.operator_sms_stock_total
    : operator.operator_sms_stock_total > 0
      ? operator.operator_sms_stock_total
      : providerBalance != null
        ? providerBalance + (usage?.sms_sent_this_month || 0)
        : null;

  if (sms_total == null && sms_remaining != null) sms_total = sms_remaining;

  let storage_total_mb = hasManualStTotal
    ? operator.operator_storage_mb_total
    : envTotalMb > 0
      ? envTotalMb
      : null;

  let storage_remaining_mb = hasManualStRem
    ? operator.operator_storage_mb_remaining
    : storage_total_mb != null && storage_total_mb > 0
      ? Math.max(0, storage_total_mb - storageUsedMb)
      : null;

  const sms_has_data = sms_remaining != null;
  const storage_has_data = storage_total_mb != null || storageUsedMb > 0;

  let sms_source = 'none';
  if (hasManualSmsRem || hasManualSmsTotal) sms_source = 'manual';
  else if (providerBalance != null) sms_source = 'sendsms.az';

  let storage_source = 'none';
  if (hasManualStRem || hasManualStTotal) storage_source = 'manual';
  else if (envTotalMb > 0) storage_source = 'hosting';
  else if (storageUsedMb > 0) storage_source = 'disk';

  return {
    sms_total: sms_total ?? 0,
    sms_remaining: sms_remaining ?? 0,
    sms_has_data,
    sms_source,
    sms_provider_error: live.sms.ok ? null : live.sms.error,
    storage_total_mb: storage_total_mb ?? 0,
    storage_remaining_mb: storage_remaining_mb ?? 0,
    storage_used_mb: storageUsedMb,
    storage_has_data,
    storage_source,
  };
}

async function getLiveInventorySnapshot() {
  const [sms, storage] = await Promise.all([
    fetchSmsProviderBalance(),
    Promise.resolve({
      ...getPlatformUploadsStorageStats(),
      env_total_mb: platformStorageTotalMb(),
    }),
  ]);
  return { sms, storage };
}

async function enrichOperatorForDisplay(operator) {
  const live = await getLiveInventorySnapshot();
  const usageStub = { storage_used_mb: 0, sms_sent_this_month: 0 };
  const display = buildInventoryDisplay(operator, usageStub, live);
  return { live, display };
}

async function buildInventoryDisplayWithUsage(operator, usage) {
  const live = await getLiveInventorySnapshot();
  const display = buildInventoryDisplay(operator, usage, live);
  return { live, display };
}

/** Canlı balansı billing_settings-ə yazır */
async function syncOperatorInventoryFromLive(operator, usage) {
  const { live, display } = await buildInventoryDisplayWithUsage(operator, usage);
  const payload = {};

  if (live.sms.ok && live.sms.balance != null) {
    payload.operator_sms_stock_remaining = live.sms.balance;
    if (!operator?.has_sms_total && display.sms_total > 0) {
      payload.operator_sms_stock_total = display.sms_total;
    }
  }

  const envTotal = live.storage.env_total_mb || 0;
  if (envTotal > 0) {
    payload.operator_storage_mb_total = envTotal;
    payload.operator_storage_mb_remaining = Math.max(0, envTotal - (display.storage_used_mb || 0));
  } else if (display.storage_used_mb > 0 && !operator?.has_storage_total) {
    payload.operator_storage_mb_total = display.storage_used_mb;
    payload.operator_storage_mb_remaining = 0;
  }

  if (!Object.keys(payload).length) {
    const err = new Error('Avtomatik sinxron üçün SMS balansı və ya PLATFORM_STORAGE_TOTAL_MB lazımdır');
    err.statusCode = 400;
    throw err;
  }

  await adminUpdateBillingSettings(payload);
  return payload;
}

module.exports = {
  buildInventoryDisplayWithUsage,
  syncOperatorInventoryFromLive,
  platformStorageTotalMb,
};
