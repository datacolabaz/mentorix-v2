import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchEngagementList } from './engagementApi'

const PLURAL = { material: 'materials', assignment: 'assignments', exam: 'exams' }
const BATCH = 200

/**
 * Siyahı səhifəsindəki bütün kartların aktivlik xülasəsi — kart başına sorğu yox, 200-lük paketlərlə.
 * Backend xülasəni irəliləyiş cədvəllərindən hesablayır (hadisə jurnalı oxunmur).
 * @returns {{ byId: Map<string, object>, loading: boolean, error: string, reload: () => Promise<void> }}
 */
export default function useActivitySummaries(type, ids, { enabled = true } = {}) {
  const plural = PLURAL[type]
  const key = [...new Set((ids || []).filter(Boolean).map(String))].sort().join(',')
  const [state, setState] = useState({ byId: new Map(), loading: false, error: '' })
  const seq = useRef(0)

  const load = useCallback(async () => {
    const list = key ? key.split(',') : []
    if (!enabled || !plural || !list.length) {
      setState({ byId: new Map(), loading: false, error: '' })
      return
    }
    const mine = ++seq.current
    setState((s) => ({ ...s, loading: true, error: '' }))
    try {
      const chunks = []
      for (let i = 0; i < list.length; i += BATCH) chunks.push(list.slice(i, i + BATCH))
      const results = await Promise.all(chunks.map((chunk) => fetchEngagementList(plural, chunk)))
      if (mine !== seq.current) return
      const byId = new Map()
      for (const res of results) {
        for (const item of Array.isArray(res?.[plural]) ? res[plural] : []) byId.set(String(item.id), item)
      }
      setState({ byId, loading: false, error: '' })
    } catch (e) {
      if (mine !== seq.current) return
      setState({ byId: new Map(), loading: false, error: e?.message || 'error' })
    }
  }, [key, plural, enabled])

  useEffect(() => {
    void load()
  }, [load])

  return { ...state, reload: load }
}
