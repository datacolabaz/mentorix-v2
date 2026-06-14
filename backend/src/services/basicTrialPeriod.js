const { BASIC_TRIAL_DAYS } = require('../config/billingTrial');

function addDays(date, days) {
  const d = new Date(date);
  if (!Number.isFinite(d.getTime())) return null;
  return new Date(d.getTime() + days * 86400000);
}

/** SADƏ paket üçün 14 günlük sınaq pəncərəsini DB sətirindən və ya defaultdan hesablayır. */
function resolveBasicTrialWindow(row) {
  const startRaw = row?.current_period_start || row?.created_at || null;
  const start = startRaw ? new Date(startRaw) : new Date();
  let end = row?.current_period_end ? new Date(row.current_period_end) : null;
  if (!end || !Number.isFinite(end.getTime())) {
    end = addDays(start, BASIC_TRIAL_DAYS);
  }
  return {
    current_period_start: Number.isFinite(start.getTime()) ? start : new Date(),
    current_period_end: Number.isFinite(end.getTime()) ? end : addDays(new Date(), BASIC_TRIAL_DAYS),
  };
}

function basicTrialExpired(endDate) {
  const endMs = endDate ? new Date(endDate).getTime() : null;
  return endMs != null && Number.isFinite(endMs) && endMs < Date.now();
}

module.exports = {
  BASIC_TRIAL_DAYS,
  resolveBasicTrialWindow,
  basicTrialExpired,
};
