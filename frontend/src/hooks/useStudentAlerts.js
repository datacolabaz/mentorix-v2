import { useCallback, useEffect, useState } from 'react'
import api from '../lib/api'
import { withEnrollmentQuery } from '../lib/studentGroupQuery'

export function useStudentAlerts({ enrollmentId } = {}) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const d = await api.get(
        withEnrollmentQuery('/notifications/student/summary', enrollmentId || ''),
      )
      setSummary(d.summary || null)
    } catch {
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [enrollmentId])

  useEffect(() => {
    setLoading(true)
    void refresh()
    const interval = window.setInterval(() => void refresh(), 60_000)
    const onRefresh = () => void refresh()
    window.addEventListener('focus', onRefresh)
    window.addEventListener('mx:student-alerts-changed', onRefresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onRefresh)
      window.removeEventListener('mx:student-alerts-changed', onRefresh)
    }
  }, [refresh])

  const tasksBadge = Number(summary?.unseen_assignments) || 0
  const notifBadge = Number(summary?.unread_notifications) || 0

  return { summary, loading, refresh, tasksBadge, notifBadge }
}

export function bumpStudentAlerts() {
  try {
    window.dispatchEvent(new CustomEvent('mx:student-alerts-changed'))
  } catch {
    /* ignore */
  }
}
