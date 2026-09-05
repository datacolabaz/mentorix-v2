const DEFAULT_INVITE_HOURS = 24;
const MAX_INVITE_HOURS = 336; // 14 days — enough for “tomorrow / next week”

function clampInviteHours(hours) {
  if (hours == null || hours === '') return DEFAULT_INVITE_HOURS;
  const n = Number(hours);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_INVITE_HOURS;
  return Math.min(Math.max(Math.round(n), 1), MAX_INVITE_HOURS);
}

/** Keep the guest link alive until the scheduled start, plus one extra day. */
function inviteHoursUntil(scheduledAt, now = Date.now()) {
  if (!scheduledAt) return DEFAULT_INVITE_HOURS;
  const t = new Date(scheduledAt).getTime();
  if (!Number.isFinite(t)) return DEFAULT_INVITE_HOURS;
  const hoursUntil = Math.ceil((t - now) / 3600000);
  return clampInviteHours(Math.max(hoursUntil + 24, DEFAULT_INVITE_HOURS));
}

module.exports = {
  DEFAULT_INVITE_HOURS,
  MAX_INVITE_HOURS,
  clampInviteHours,
  inviteHoursUntil,
};
