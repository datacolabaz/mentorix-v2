import { useCallback, useEffect, useState } from 'react'
import api from '../lib/api'
import {
  buildInstructorNavSectionsFromClient,
  buildInstructorNavSections,
} from '../constants/instructorNav'

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
  const [sections, setSections] = useState(() => buildInstructorNavSections())
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const nav = await fetchInstructorNavConfig()
      if (nav?.sections?.length) {
        setSections(buildInstructorNavSectionsFromClient(nav))
      }
    } catch {
      setSections(buildInstructorNavSections())
    } finally {
      setLoading(false)
    }
  }, [])

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
