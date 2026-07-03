import { useEffect, useMemo, useRef, useState } from 'react'
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

function filesSignature(files) {
  if (!Array.isArray(files) || files.length === 0) return ''
  return files.map((f) => `${f.id || ''}|${f.url || ''}`).join(';')
}

/** JWT ilə qorunan imtahan faylları üçün blob URL-lər */
export function useExamMaterialBlobs(examId, files) {
  const [blobById, setBlobById] = useState({})
  const filesRef = useRef(files)
  filesRef.current = files

  const signature = filesSignature(files)
  const loadKey = useMemo(() => {
    if (!examId || !signature) return ''
    return `${examId}\0${signature}`
  }, [examId, signature])

  useEffect(() => {
    if (!loadKey || !examId) {
      setBlobById({})
      return undefined
    }
    const list = Array.isArray(filesRef.current) ? filesRef.current : []
    const ac = new AbortController()
    const toRevoke = []
    let cancelled = false

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
          if (ac.signal.aborted || cancelled) return
          const u = URL.createObjectURL(blob)
          toRevoke.push(u)
          next[m.id] = u
        } catch (e) {
          if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED' || ac.signal.aborted) return
          next[m.id] = null
        }
      }
      if (!ac.signal.aborted && !cancelled) setBlobById(next)
    })()

    return () => {
      cancelled = true
      ac.abort()
      toRevoke.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [loadKey, examId])

  return blobById
}
