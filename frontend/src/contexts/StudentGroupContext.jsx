import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api from '../lib/api'
import useAuthStore from '../hooks/useAuth'
import { readStoredEnrollmentId, storeEnrollmentId } from '../lib/studentGroupQuery'
import { bumpStudentAlerts } from '../hooks/useStudentAlerts'

const StudentGroupContext = createContext(null)

export function StudentGroupProvider({ children }) {
  const { user } = useAuthStore()
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeEnrollmentId, setActiveEnrollmentIdState] = useState(() => readStoredEnrollmentId())

  const refreshEnrollments = useCallback(async () => {
    if (!user?.id || user.role !== 'student') {
      setEnrollments([])
      setLoading(false)
      return []
    }
    setLoading(true)
    try {
      const d = await api.get('/students/my/enrollments')
      const list = (Array.isArray(d.enrollments) ? d.enrollments : []).filter(
        (e) => e && e.enrollment_id != null,
      )
      setEnrollments(list)
      return list
    } catch {
      setEnrollments([])
      return []
    } finally {
      setLoading(false)
    }
  }, [user?.id, user?.role])

  useEffect(() => {
    void refreshEnrollments()
  }, [refreshEnrollments])

  useEffect(() => {
    if (!enrollments.length) {
      if (activeEnrollmentId) {
        setActiveEnrollmentIdState('')
        storeEnrollmentId('')
      }
      return
    }
    const exists = enrollments.some(
      (e) => e && String(e.enrollment_id) === String(activeEnrollmentId),
    )
    if (!activeEnrollmentId || !exists) {
      const next = enrollments[0]?.enrollment_id
      if (next) {
        setActiveEnrollmentIdState(next)
        storeEnrollmentId(next)
      }
    }
  }, [enrollments, activeEnrollmentId])

  const setActiveEnrollmentId = useCallback((id) => {
    setActiveEnrollmentIdState(id || '')
    storeEnrollmentId(id || '')
    bumpStudentAlerts()
  }, [])

  const activeEnrollment = useMemo(
    () =>
      enrollments.find(
        (e) => e && String(e.enrollment_id) === String(activeEnrollmentId),
      ) || null,
    [enrollments, activeEnrollmentId],
  )

  const value = useMemo(
    () => ({
      enrollments,
      loading,
      activeEnrollmentId,
      activeEnrollment,
      setActiveEnrollmentId,
      refreshEnrollments,
      hasGroups: enrollments.length > 0,
    }),
    [
      enrollments,
      loading,
      activeEnrollmentId,
      activeEnrollment,
      setActiveEnrollmentId,
      refreshEnrollments,
    ],
  )

  return <StudentGroupContext.Provider value={value}>{children}</StudentGroupContext.Provider>
}

export function useStudentGroups() {
  const ctx = useContext(StudentGroupContext)
  if (!ctx) {
    throw new Error('useStudentGroups must be used within StudentGroupProvider')
  }
  return ctx
}

export function useStudentGroupsOptional() {
  return useContext(StudentGroupContext)
}
