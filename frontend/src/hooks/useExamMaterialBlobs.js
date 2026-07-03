import { useEffect, useMemo, useState } from 'react'
import api from '../lib/api'

function examUploadsStoredFilename(url) {
  const s = String(url || '')
  let m = s.match(/\/api\/uploads\/exams\/([^/?#]+)$/i)
  if (m) return decodeURIComponent(m[1])
  m = s.match(/uploads\/exams\/([^/?#]+)$/i)
  return m ? decodeURIComponent(m[1]) : null
}

export function materialFileApiPath(url, examId) {
  const fn = examUploadsStoredFilename(url)
  if (!fn || !examId) return null
  return `/exams/by-exam/${encodeURIComponent(examId)}/attachment/${encodeURIComponent(fn)}`
}

/** JWT ilə qorunan imtahan faylları üçün blob URL-lər */
export function useExamMaterialBlobs(examId, files) {
  const [blobById, setBlobById] = useState({})

  const loadKey = useMemo(() => {
    if (!examId || !Array.isArray(files) || files.length === 0) return ''
    return `${examId}\0${files.map((f) => f.id || f.url).join('\0')}`
  }, [examId, files])

  useEffect(() => {
    if (!loadKey || !examId) {
      setBlobById({})
      return undefined
    }
    const list = Array.isArray(files) ? files : []
    const ac = new AbortController()
    const toRevoke = []

    ;(async () => {
      const next = {}
      for (const m of list) {
        const apiPath = materialFileApiPath(m.url, examId)
        if (!apiPath) {
          next[m.id] = null
          continue
        }
        try {
          const blob = await api.get(apiPath, { responseType: 'blob', signal: ac.signal })
          const u = URL.createObjectURL(blob)
          toRevoke.push(u)
          next[m.id] = u
        } catch (e) {
          if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return
          next[m.id] = null
        }
      }
      if (!ac.signal.aborted) setBlobById(next)
    })()

    return () => {
      ac.abort()
      toRevoke.forEach((u) => URL.revokeObjectURL(u))
      setBlobById({})
    }
  }, [loadKey, examId, files])

  return blobById
}
