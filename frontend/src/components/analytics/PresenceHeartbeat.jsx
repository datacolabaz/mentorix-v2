import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import useAuthStore from '../../hooks/useAuth'
import { trackPresencePing } from '../../lib/analytics'

const PING_MS = 60_000

/** Aktiv sessiyaları admin paneldə "online" saymaq üçün */
export default function PresenceHeartbeat() {
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    const ping = () => trackPresencePing(user?.role)

    ping()
    const timer = window.setInterval(ping, PING_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') ping()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [pathname, user?.id, user?.role])

  return null
}
