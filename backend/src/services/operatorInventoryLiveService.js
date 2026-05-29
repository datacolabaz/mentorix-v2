const { fetchSmsProviderBalance } = require('./smsService');
const { getPlatformHostingStorageStats } = require('./resourceUsageService');
const { adminUpdateBillingSettings } = require('./billingSettingsService');

function buildInventoryDisplay(operator, usage, live) {
  const op = operator || {};
  const hasManualSmsTotal = Boolean(op.has_sms_total);
  const hasManualSmsRem = Boolean(op.has_sms_remaining);
  const hasManualStTotal = Boolean(op.has_storage_total);
  const hasManualStRem = Boolean(op.has_storage_remaining);

  const providerBalance = live.sms.ok ? live.sms.balance : null;
  const smsUsedMonth = Number(usage?.sms_sent_this_month || 0) || 0;
  const smsUsedAllTime = Number(usage?.sms_sent_all_time || 0) || 0;
  const smsAllocated = Number(usage?.sms_allocated_to_instructors || 0) || 0;

  const disk = live.storage.disk;
  const fileUsedMb = live.storage.storage_used_mb ?? 0;
  const dbUsedMb = usage?.storage_used_mb ?? 0;
  const diskUsedMb = disk?.used_mb ?? 0;
  const storageUsedMb = Math.max(fileUsedMb, dbUsedMb, diskUsedMb);

  const envTotalMb = live.storage.env_total_mb || 0;
  const diskTotalMb = disk?.total_mb ?? 0;
  const diskFreeMb = disk?.free_mb ?? 0;

  let sms_remaining = hasManualSmsRem ? op.operator_sms_stock_remaining : providerBalance;
  if (sms_remaining == null && !hasManualSmsRem && op.operator_sms_stock_remaining > 0) {
    sms_remaining = op.operator_sms_stock_remaining;
  }

  let sms_total = null;
  if (hasManualSmsTotal) {
    sms_total = op.operator_sms_stock_total;
  } else if (op.operator_sms_stock_total > 0) {
    sms_total = op.operator_sms_stock_total;
  } else if (providerBalance != null) {
    sms_total = providerBalance + smsUsedMonth;
  } else if (sms_remaining != null) {
    sms_total = sms_remaining;
  }

  let sms_remaining_estimate = null;
  if (sms_remaining == null && sms_total != null && sms_total > 0) {
    sms_remaining_estimate = Math.max(0, sms_total - smsUsedAllTime);
  } else if (sms_remaining == null && op.operator_sms_stock_total > 0) {
    sms_remaining_estimate = Math.max(0, op.operator_sms_stock_total - smsUsedAllTime);
  }

  let storage_total_mb = null;
  if (hasManualStTotal) storage_total_mb = op.operator_storage_mb_total;
  else if (diskTotalMb > 0) storage_total_mb = diskTotalMb;
  else if (envTotalMb > 0) storage_total_mb = envTotalMb;

  let storage_remaining_mb = null;
  if (hasManualStRem) {
    storage_remaining_mb = op.operator_storage_mb_remaining;
  } else if (diskFreeMb > 0) {
    storage_remaining_mb = diskFreeMb;
  } else if (storage_total_mb != null && storage_total_mb > 0) {
    storage_remaining_mb = Math.max(0, storage_total_mb - storageUsedMb);
  }

  const sms_has_estimate = sms_remaining == null && sms_remaining_estimate != null;
  const sms_has_balance = sms_remaining != null;
  const sms_has_data =
    sms_has_balance || sms_has_estimate || smsUsedMonth > 0 || smsUsedAllTime > 0;
  const storage_has_data =
    storage_total_mb != null || storage_remaining_mb != null || storageUsedMb > 0;
  const storage_has_limit = storage_total_mb != null && storage_total_mb > 0;

  let sms_source = 'none';
  if (hasManualSmsRem || hasManualSmsTotal) sms_source = 'manual';
  else if (providerBalance != null) sms_source = 'sendsms.az';
  else if (sms_has_estimate) sms_source = 'estimate';
  else if (sms_remaining != null && op.operator_sms_stock_remaining > 0) sms_source = 'saved';

  let storage_source = 'none';
  if (hasManualStRem || hasManualStTotal) storage_source = 'manual';
  else if (diskTotalMb > 0) storage_source = 'railway-disk';
  else if (envTotalMb > 0) storage_source = 'env-limit';
  else if (storageUsedMb > 0) storage_source = 'uploads-scan';

  return {
    sms_total: sms_total ?? 0,
    sms_remaining: sms_remaining ?? sms_remaining_estimate ?? 0,
    sms_remaining_estimate: sms_remaining_estimate ?? null,
    sms_used_this_month: smsUsedMonth,
    sms_used_all_time: smsUsedAllTime,
    sms_allocated_to_instructors: smsAllocated,
    sms_has_data,
    sms_has_balance,
    sms_has_estimate,
    sms_source,
    sms_provider_error: live.sms.ok ? null : live.sms.error,
    storage_total_mb: storage_total_mb ?? 0,
    storage_remaining_mb: storage_remaining_mb ?? null,
    storage_used_mb: storageUsedMb,
    storage_free_mb: storage_remaining_mb,
    storage_has_data,
    storage_has_limit,
    storage_source,
    storage_disk_path: disk?.path ?? live.storage?.uploads_root ?? null,
  };
}

async function getLiveInventorySnapshot() {
  const [sms, storage] = await Promise.all([
    fetchSmsProviderBalance().catch((e) => ({
      ok: false,
      balance: null,
      error: e?.message || 'SMS balans sorğusu uğursuz',
    })),
    getPlatformHostingStorageStats().catch(() => ({
      storage_used_mb: 0,
      storage_used_bytes: 0,
      uploads_root: null,
      disk: null,
      env_total_mb: 0,
    })),
  ]);
  return { sms, storage };
}

async function buildInventoryDisplayWithUsage(operator, usage) {
  const live = await getLiveInventorySnapshot();
  const display = buildInventoryDisplay(operator, usage, live);
  return { live, display };
}

async function syncOperatorInventoryFromLive(operator, usage) {
  const { live, display } = await buildInventoryDisplayWithUsage(operator, usage);
  const payload = {};

  if (live.sms.ok && live.sms.balance != null) {
    payload.operator_sms_stock_remaining = live.sms.balance;
    if (!operator?.has_sms_total && display.sms_total > 0) {
      payload.operator_sms_stock_total = display.sms_total;
    }
  }

  const diskTotal = live.storage.disk?.total_mb || 0;
  const envTotal = live.storage.env_total_mb || 0;
  const totalMb = diskTotal > 0 ? diskTotal : envTotal;
  if (totalMb > 0) {
    payload.operator_storage_mb_total = totalMb;
    const free =
      live.storage.disk?.free_mb != null
        ? live.storage.disk.free_mb
        : Math.max(0, totalMb - (display.storage_used_mb || 0));
    payload.operator_storage_mb_remaining = free;
  } else if (display.storage_used_mb > 0 && !operator?.has_storage_total) {
    payload.operator_storage_mb_total = display.storage_used_mb;
    payload.operator_storage_mb_remaining = 0;
  }

  if (!Object.keys(payload).length) {
    const err = new Error(
      'Sinxron üçün SMS balansı (QuickSMS) və ya Railway disk/env PLATFORM_STORAGE_TOTAL_MB lazımdır'
    );
    err.statusCode = 400;
    throw err;
  }

  await adminUpdateBillingSettings(payload);
  return payload;
}

module.exports = {
  buildInventoryDisplayWithUsage,
  syncOperatorInventoryFromLive,
};
