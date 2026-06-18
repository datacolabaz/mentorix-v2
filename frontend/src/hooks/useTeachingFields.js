import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../lib/api'
import { normalizeTeachingSubjects } from '../lib/teachingSubjects'

/** Müəllimin Kurslar və qruplar (/instructor/teaching) məlumatı */
export function useTeachingFields() {
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const d = await api.get('/instructor/teaching')
      setSubjects(Array.isArray(d?.subjects) ? d.subjects : [])
    } catch (e) {
      setSubjects([])
      setError(e?.message || 'Sahə və qruplar yüklənmədi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const fields = useMemo(
    () => normalizeTeachingSubjects(subjects).filter((s) => s && !s.is_system),
    [subjects],
  )

  const allGroups = useMemo(() => {
    const out = []
    for (const field of fields) {
      for (const group of field.groups || []) {
        out.push({
          ...group,
          subject_id: field.id,
          subject_name: field.name,
        })
      }
    }
    return out
  }, [fields])

  return { fields, allGroups, loading, error, refresh }
}

export function groupsForField(fields, fieldId) {
  if (!fieldId) return []
  const field = fields.find((f) => String(f.id) === String(fieldId))
  return Array.isArray(field?.groups) ? field.groups : []
}
