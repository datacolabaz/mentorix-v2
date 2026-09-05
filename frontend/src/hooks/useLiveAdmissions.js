import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../lib/api'

export default function useLiveAdmissions(roomCode, enabled) {
  const [pending, setPending] = useState([])
  const [busyId, setBusyId] = useState(null)
  const seenRef = useRef(new Set())

  const load = useCallback(async () => {
    if (!roomCode || !enabled) return []
    const res = await api.get(`/live/${encodeURIComponent(roomCode)}/admissions`)
    const rows = Array.isArray(res?.pending) ? res.pending : []
    setPending(rows)
    return rows
  }, [roomCode, enabled])

  useEffect(() => {
    if (!roomCode || !enabled) {
      setPending([])
      return undefined
    }
    let cancelled = false
    const tick = async () => {
      try {
        const rows = await load()
        if (cancelled) return
        rows.forEach((row) => {
          if (row?.id) seenRef.current.add(row.id)
        })
      } catch {
        /* instructor may briefly lose the room */
      }
    }
    void tick()
    const id = window.setInterval(() => void tick(), 2500)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [roomCode, enabled, load])

  const decide = useCallback(
    async (admissionId, action) => {
      if (!roomCode || !admissionId) return
      setBusyId(admissionId)
      try {
        const path = action === 'deny' ? 'deny' : 'approve'
        await api.post(
          `/live/${encodeURIComponent(roomCode)}/admissions/${encodeURIComponent(admissionId)}/${path}`,
        )
        setPending((prev) => prev.filter((row) => row.id !== admissionId))
      } finally {
        setBusyId(null)
      }
    },
    [roomCode],
  )

  return { pending, busyId, approve: (id) => decide(id, 'approve'), deny: (id) => decide(id, 'deny') }
}
