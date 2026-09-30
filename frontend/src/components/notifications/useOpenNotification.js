import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { openNotification } from './notificationsApi'
import { notifyNotificationsChanged } from '../../hooks/useNotificationUnread'
import { isSafeInternalHref } from '../../lib/notificationPresentation'

/**
 * Opens a notification: the backend marks it read and re-checks that the user may still
 * see the target. Returns `{ status }` so callers can explain `forbidden` / `not_found` / `none`.
 */
export function useOpenNotification({ onBeforeNavigate, source = '' } = {}) {
  const navigate = useNavigate()
  const [openingId, setOpeningId] = useState(null)

  const open = useCallback(
    async (n) => {
      if (!n?.id) return { status: 'none' }
      setOpeningId(n.id)
      try {
        const d = await openNotification(n.id)
        notifyNotificationsChanged(source)
        if (d?.status === 'ok' && isSafeInternalHref(d.href)) {
          onBeforeNavigate?.()
          navigate(d.href)
          return { status: 'ok' }
        }
        return { status: d?.status === 'ok' ? 'none' : d?.status || 'none' }
      } catch (e) {
        return { status: e?.status === 404 ? 'not_found' : 'error' }
      } finally {
        setOpeningId(null)
      }
    },
    [navigate, onBeforeNavigate, source],
  )

  return { open, openingId }
}
