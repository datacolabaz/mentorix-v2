/** Online / active status helpers (1 minute window, matches backend). */

export const ONLINE_WINDOW_MS = 60 * 1000

export function isUserOnline(lastActivityAt, nowMs = Date.now()) {
  if (!lastActivityAt) return false
  const ts = new Date(lastActivityAt).getTime()
  if (!Number.isFinite(ts)) return false
  return nowMs - ts <= ONLINE_WINDOW_MS
}

export function presenceTitle(isOnline, lastActivityAt) {
  if (isOnline) return 'Onlayn'
  if (!lastActivityAt) return 'Son aktivlik məlum deyil'
  try {
    return `Son aktivlik: ${new Date(lastActivityAt).toLocaleString('az-AZ')}`
  } catch {
    return 'Oflayn'
  }
}

/** Prefer API `is_online`; fall back to client-side check from timestamp. */
export function resolveOnlineStatus(userOrRow) {
  if (userOrRow?.is_online === true) return true
  if (userOrRow?.is_online === false) return false
  return isUserOnline(userOrRow?.last_activity_at)
}
