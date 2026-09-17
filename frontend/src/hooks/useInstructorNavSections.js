import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'
import {
  buildInstructorNavSectionsFromClient,
  buildInstructorNavSections,
  buildMentorNavSections,
  defaultMentorNavSections,
} from '../constants/instructorNav'
import useAuthStore from './useAuth'
import { localizeInstructorNavSections } from '../lib/localizeNav'

const NAV_REFRESH_EVENT = 'mx:instructor-nav-updated'

async function fetchInstructorNavConfig() {
  const cacheBust = `_=${Date.now()}`
  try {
    const data = await api.get(`/instructor/nav-sections?${cacheBust}`)
    if (data?.success && data?.nav?.sections?.length) return data.nav
  } catch {
    /* instructor endpoint may be unavailable on older API builds */
  }

  const data = await api.get(`/public/instructor-nav?${cacheBust}`)
  if (data?.success && data?.nav?.sections?.length) return data.nav
  return null
}

export function notifyInstructorNavUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NAV_REFRESH_EVENT))
  }
}

export function useInstructorNavSections() {
  const { t, i18n } = useTranslation()
  const { user } = useAuthStore()
  const [activeWorkspace, setActiveWorkspace] = useState(() => {
    try {
      return String(localStorage.getItem('mx_active_workspace') || '').toLowerCase()
    } catch {
      return ''
    }
  })
  const isMentor = activeWorkspace ? activeWorkspace === 'mentor' : String(user?.persona || '').toLowerCase() === 'mentor'

  useEffect(() => {
    const persona = String(user?.persona || '').toLowerCase()
    if (!persona || activeWorkspace) return
    const initialWorkspace = persona === 'mentor' ? 'mentor' : persona === 'teacher' ? 'teacher' : ''
    if (!initialWorkspace) return
    try {
      localStorage.setItem('mx_active_workspace', initialWorkspace)
    } catch {
      /* ignore storage failures */
    }
    setActiveWorkspace(initialWorkspace)
  }, [user?.persona, activeWorkspace])

  useEffect(() => {
    const onWorkspaceSwitch = (event) => setActiveWorkspace(String(event.detail || '').toLowerCase())
    window.addEventListener('mx:workspace-switched', onWorkspaceSwitch)
    return () => window.removeEventListener('mx:workspace-switched', onWorkspaceSwitch)
  }, [])

  const [rawSections, setRawSections] = useState(() =>
    isMentor
      ? buildMentorNavSections()
      : buildInstructorNavSections(),
  )
  const [loading, setLoading] = useState(true)

  const sections = useMemo(
    () => localizeInstructorNavSections(rawSections, t),
    [rawSections, t, i18n.language],
  )

  const refresh = useCallback(async () => {
    if (isMentor) {
      setRawSections(buildMentorNavSections())
      setLoading(false)
      return
    }
    try {
      const nav = await fetchInstructorNavConfig()
      if (nav?.sections?.length) {
        setRawSections(buildInstructorNavSectionsFromClient(nav))
      }
    } catch {
      setRawSections(buildInstructorNavSections())
    } finally {
      setLoading(false)
    }
  }, [isMentor])

  useEffect(() => {
    if (isMentor) {
      setRawSections(buildMentorNavSections())
    } else {
      void refresh()
    }
  }, [isMentor, refresh])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await refresh()
      if (cancelled) return
    })()
    return () => {
      cancelled = true
    }
  }, [refresh])

  useEffect(() => {
    const onRefresh = () => {
      void refresh()
    }
    const onFocus = () => {
      void refresh()
    }
    window.addEventListener(NAV_REFRESH_EVENT, onRefresh)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener(NAV_REFRESH_EVENT, onRefresh)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  return { sections, loading, refresh }
}
