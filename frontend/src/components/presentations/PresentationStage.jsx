import { useEffect, useRef, useState } from 'react'
import PdfSlideCanvas from './PdfSlideCanvas'
import AnnotationLayer from './AnnotationLayer'

export default function PresentationStage({
  pdf,
  page,
  fit = true,
  zoom = 1,
  strokes,
  tool,
  defaults,
  onCommit,
  className = '',
}) {
  const boxRef = useRef(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [pageSize, setPageSize] = useState({ w: 1, h: 1 })

  useEffect(() => {
    const el = boxRef.current
    if (!el) return undefined
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (!r) return
      setBox({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!pdf || !page) return undefined
    let cancelled = false
    pdf.getPage(page).then((p) => {
      if (cancelled) return
      const v = p.getViewport({ scale: 1 })
      setPageSize({ w: v.width, h: v.height })
    }).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [pdf, page])

  const availW = Math.max(0, box.w)
  const availH = Math.max(0, box.h)
  const fitScale = pageSize.w && pageSize.h && availW && availH
    ? Math.min(availW / pageSize.w, availH / pageSize.h)
    : 1
  const scale = fit ? fitScale : fitScale * zoom
  const cssWidth = Math.max(1, Math.floor(pageSize.w * scale))
  const cssHeight = Math.max(1, Math.floor(pageSize.h * scale))

  return (
    <div ref={boxRef} className={`relative flex items-center justify-center min-h-0 min-w-0 overflow-hidden ${className}`}>
      {pdf && page && cssWidth > 1 ? (
        <div className="relative shadow-2xl" style={{ width: cssWidth, height: cssHeight }}>
          <PdfSlideCanvas pdf={pdf} pageNumber={page} cssWidth={cssWidth} cssHeight={cssHeight} />
          <AnnotationLayer
            width={cssWidth}
            height={cssHeight}
            strokes={strokes}
            tool={tool}
            defaults={defaults}
            onCommit={onCommit}
          />
        </div>
      ) : null}
    </div>
  )
}
