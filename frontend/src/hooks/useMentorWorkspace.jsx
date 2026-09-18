import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api from '../lib/api'
import useAuthStore from './useAuth'

const MentorWorkspaceContext = createContext(null)

export function getActiveWorkspace(user) {
  if (String(user?.persona || '').toLowerCase() === 'mentor') return 'mentor'
  try {
    return String(localStorage.getItem('mx_active_workspace') || '').toLowerCase()
  } catch {
    return ''
  }
}

export function useIsMentorWorkspace() {
  const { user } = useAuthStore()
  const [workspace, setWorkspace] = useState(() => getActiveWorkspace(user))

  useEffect(() => {
    setWorkspace(getActiveWorkspace(user))
    const sync = (event) => setWorkspace(String(event?.detail || getActiveWorkspace(user)).toLowerCase())
    window.addEventListener('mx:workspace-switched', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('mx:workspace-switched', sync)
      window.removeEventListener('storage', sync)
    }
  }, [user])

  return String(user?.persona || '').toLowerCase() === 'mentor' || workspace === 'mentor'
}

const EMPTY = {
  goals: [],
  sessions: [],
  actions: [],
  services: [],
  resources: [],
  agreements: [],
  mentees: [],
}

export function MentorWorkspaceProvider({ children }) {
  const active = useIsMentorWorkspace()
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!active) return
    setLoading(true)
    setError('')
    try {
      const [workspace, studentData] = await Promise.all([
        api.get('/mentor/workspace'),
        api.get('/students').catch(() => ({ students: [] })),
      ])
      setData({ ...EMPTY, ...(workspace || {}), mentees: Array.isArray(studentData?.students) ? studentData.students : [] })
    } catch (err) {
      setError(err?.message || 'Mentor workspace məlumatları yüklənmədi')
    } finally {
      setLoading(false)
    }
  }, [active])

  useEffect(() => {
    if (active) refresh()
    else setData(EMPTY)
  }, [active, refresh])

  const mutate = useCallback(async (request) => {
    const result = await request()
    await refresh()
    return result
  }, [refresh])

  const actions = useMemo(() => ({
    createGoal: (payload) => mutate(() => api.post('/mentor/goals', payload)),
    updateGoal: (id, payload) => mutate(() => api.patch(`/mentor/goals/${encodeURIComponent(id)}`, payload)),
    createMilestone: (goalId, payload) => mutate(() => api.post(`/mentor/goals/${encodeURIComponent(goalId)}/milestones`, payload)),
    updateMilestone: (goalId, id, payload) => mutate(() => api.patch(`/mentor/goals/${encodeURIComponent(goalId)}/milestones/${encodeURIComponent(id)}`, payload)),
    createSession: (payload) => mutate(() => api.post('/mentor/sessions', payload)),
    updateSession: (id, payload) => mutate(() => api.patch(`/mentor/sessions/${encodeURIComponent(id)}`, payload)),
    createAction: (payload) => mutate(() => api.post('/mentor/actions', payload)),
    updateAction: (id, payload) => mutate(() => api.patch(`/mentor/actions/${encodeURIComponent(id)}`, payload)),
    createService: (payload) => mutate(() => api.post('/mentor/services', payload)),
    updateService: (id, payload) => mutate(() => api.patch(`/mentor/services/${encodeURIComponent(id)}`, payload)),
    createResource: (payload) => mutate(() => api.post('/mentor/resources', payload)),
    deleteResource: (id) => mutate(() => api.delete(`/mentor/resources/${encodeURIComponent(id)}`)),
    saveAgreement: (payload) => mutate(() => api.put('/mentor/agreements', payload)),
  }), [mutate])

  const value = useMemo(() => ({ active, data, loading, error, refresh, ...actions }), [active, data, loading, error, refresh, actions])
  return <MentorWorkspaceContext.Provider value={value}>{children}</MentorWorkspaceContext.Provider>
}

export default function useMentorWorkspace() {
  const value = useContext(MentorWorkspaceContext)
  if (!value) throw new Error('useMentorWorkspace must be used inside MentorWorkspaceProvider')
  return value
}
