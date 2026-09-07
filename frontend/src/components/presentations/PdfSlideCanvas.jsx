import { useEffect, useRef } from 'react'

export default function PdfSlideCanvas({
  pdf,
  pageNumber,
  cssWidth,
  cssHeight,
  className = '',
}) {
  const canvasRef = useRef(null)
  const renderRef = useRef(null)

  useEffect(() => {
    if (!pdf || !pageNumber || !cssWidth || !cssHeight) return undefined
    const canvas = canvasRef.current
    if (!canvas) return undefined

    let cancelled = false

    ;(async () => {
      try {
        if (renderRef.current) {
          try {
            renderRef.current.cancel()
          } catch {
            /* ignore */
          }
        }
        const page = await pdf.getPage(pageNumber)
        if (cancelled) return
        const unscaled = page.getViewport({ scale: 1 })
        const scale = Math.min(cssWidth / unscaled.width, cssHeight / unscaled.height)
        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
        const viewport = page.getViewport({ scale: scale * dpr })
        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.width = `${cssWidth}px`
        canvas.style.height = `${cssHeight}px`
        const ctx = canvas.getContext('2d', { alpha: false })
        renderRef.current = page.render({ canvasContext: ctx, viewport })
        await renderRef.current.promise
      } catch (e) {
        if (e?.name === 'RenderingCancelledException') return
      }
    })()

    return () => {
      cancelled = true
      try {
        renderRef.current?.cancel?.()
      } catch {
        /* ignore */
      }
    }
  }, [pdf, pageNumber, cssWidth, cssHeight])

  return (
    <canvas
      ref={canvasRef}
      className={`block bg-white ${className}`}
      style={{ width: cssWidth, height: cssHeight }}
    />
  )
}
