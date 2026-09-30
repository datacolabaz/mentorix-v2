import { useEffect, useSyncExternalStore } from 'react'
import { fetchUnreadCount } from '../components/notifications/notificationsApi'

export const NOTIFICATIONS_CHANGED_EVENT = 'mx:notifications-changed'
const POLL_MS = 60_000

/* One poller per tab, shared by every mounted bell (mobile + desktop headers render both). */
let unread = 0
let subscribers = 0
let timer = null
let inflight = null
const listeners = new Set()

function emit() {
  for (const l of listeners) l()
}

async function refresh() {
  if (inflight) return inflight
  if (!localStorage.getItem('mx_token')) return undefined
  inflight = fetchUnreadCount()
    .then((d) => {
      const n = Math.max(0, Number(d?.unread_count) || 0)
      if (n !== unread) {
        unread = n
        emit()
      }
    })
    .catch(() => {})
    .finally(() => {
      inflight = null
    })
  return inflight
}

function onVisible() {
  if (document.visibilityState === 'visible') void refresh()
}

function onChanged() {
  void refresh()
}

function start() {
  void refresh()
  timer = window.setInterval(() => {
    if (document.visibilityState !== 'hidden') void refresh()
  }, POLL_MS)
  window.addEventListener('focus', onChanged)
  window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged)
  window.addEventListener('mx:student-alerts-changed', onChanged)
  document.addEventListener('visibilitychange', onVisible)
}

function stop() {
  window.clearInterval(timer)
  timer = null
  window.removeEventListener('focus', onChanged)
  window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged)
  window.removeEventListener('mx:student-alerts-changed', onChanged)
  document.removeEventListener('visibilitychange', onVisible)
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return unread
}

/** Call after marking notifications read/unread so every bell and the legacy student badges refresh. */
export function notifyNotificationsChanged(source = '') {
  try {
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT, { detail: { source } }))
    window.dispatchEvent(new CustomEvent('mx:student-alerts-changed'))
  } catch {
    /* ignore */
  }
}

export function useNotificationUnread() {
  const count = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    subscribers += 1
    if (subscribers === 1) start()
    return () => {
      subscribers -= 1
      if (subscribers === 0) {
        stop()
        unread = 0
      }
    }
  }, [])

  return { unreadCount: count, refresh }
}
