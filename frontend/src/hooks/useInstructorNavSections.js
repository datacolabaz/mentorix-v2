import { useEffect, useState } from 'react'
import api from '../lib/api'
import {
  buildInstructorNavSectionsFromClient,
  buildInstructorNavSections,
} from '../constants/instructorNav'

export function useInstructorNavSections() {
  const [sections, setSections] = useState(() => buildInstructorNavSections())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.get('/public/instructor-nav')
        if (cancelled) return
        if (data?.success && data?.nav) {
          setSections(buildInstructorNavSectionsFromClient(data.nav))
        }
      } catch {
        if (!cancelled) setSections(buildInstructorNavSections())
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { sections, loading }
}
