import { useEffect, useState } from 'react'
import { pdfjsLib } from '../lib/pdfjs'

export default function usePdfDocument(url) {
  const [pdf, setPdf] = useState(null)
  const [pageCount, setPageCount] = useState(0)
  const [loading, setLoading] = useState(Boolean(url))
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!url) {
      setPdf(null)
      setPageCount(0)
      setLoading(false)
      setError(null)
      return undefined
    }

    let cancelled = false
    let task = null
    setLoading(true)
    setError(null)
    setPdf(null)

    ;(async () => {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error('PDF')
        const data = await res.arrayBuffer()
        if (cancelled) return
        task = pdfjsLib.getDocument({ data })
        const doc = await task.promise
        if (cancelled) {
          doc.destroy()
          return
        }
        setPdf(doc)
        setPageCount(doc.numPages || 0)
      } catch (e) {
        if (!cancelled) setError(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      try {
        task?.destroy?.()
      } catch {
        /* ignore */
      }
    }
  }, [url])

  return { pdf, pageCount, loading, error }
}
