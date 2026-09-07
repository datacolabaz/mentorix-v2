import { useEffect, useRef } from 'react'

function distPointToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function strokeHits(stroke, x, y, radius) {
  const pts = stroke.points || []
  if (!pts.length) return false
  if (pts.length === 1) return Math.hypot(pts[0].x - x, pts[0].y - y) <= radius
  for (let i = 1; i < pts.length; i += 1) {
    if (distPointToSeg(x, y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) <= radius) return true
  }
  return false
}

function drawStroke(ctx, stroke, width, height) {
  const pts = stroke.points || []
  if (!pts.length) return
  ctx.save()
  ctx.globalAlpha = stroke.opacity ?? 1
  ctx.strokeStyle = stroke.color || '#111827'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = (stroke.width || 2.5) * Math.min(width, height) / 640
  ctx.beginPath()
  ctx.moveTo(pts[0].x * width, pts[0].y * height)
  for (let i = 1; i < pts.length; i += 1) {
    ctx.lineTo(pts[i].x * width, pts[i].y * height)
  }
  if (pts.length === 1) {
    ctx.lineTo(pts[0].x * width + 0.01, pts[0].y * height)
  }
  ctx.stroke()
  ctx.restore()
}

export default function AnnotationLayer({
  width,
  height,
  strokes = [],
  tool = 'pen',
  defaults,
  onCommit,
  enabled = true,
}) {
  const canvasRef = useRef(null)
  const drawingRef = useRef(null)
  const liveStrokesRef = useRef(strokes)
  const eraserDirtyRef = useRef(false)

  useEffect(() => {
    liveStrokesRef.current = strokes
  }, [strokes])

  const paint = (extra) => {
    const canvas = canvasRef.current
    if (!canvas || !width || !height) return
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    for (const stroke of liveStrokesRef.current || []) drawStroke(ctx, stroke, width, height)
    if (extra) drawStroke(ctx, extra, width, height)
  }

  useEffect(() => {
    paint(drawingRef.current)
  }, [strokes, width, height])

  const pointFromEvent = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    return {
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
      p: Number.isFinite(e.pressure) && e.pressure > 0 ? e.pressure : 0.5,
    }
  }

  const onPointerDown = (e) => {
    if (!enabled) return
    e.preventDefault()
    canvasRef.current?.setPointerCapture?.(e.pointerId)
    const pt = pointFromEvent(e)
    if (tool === 'eraser') {
      eraserDirtyRef.current = false
      const radius = (defaults?.width || 16) / Math.min(width, height)
      const next = liveStrokesRef.current.filter((s) => !strokeHits(s, pt.x, pt.y, radius * 2))
      if (next.length !== liveStrokesRef.current.length) {
        liveStrokesRef.current = next
        eraserDirtyRef.current = true
        paint()
      }
      drawingRef.current = { tool: 'eraser', points: [pt] }
      return
    }
    drawingRef.current = {
      id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tool,
      color: defaults?.color || '#111827',
      width: defaults?.width || 2.5,
      opacity: defaults?.opacity ?? 1,
      points: [pt],
    }
    paint(drawingRef.current)
  }

  const onPointerMove = (e) => {
    if (!drawingRef.current) return
    e.preventDefault()
    const pt = pointFromEvent(e)
    if (tool === 'eraser') {
      const radius = (defaults?.width || 16) / Math.min(width, height)
      const next = liveStrokesRef.current.filter((s) => !strokeHits(s, pt.x, pt.y, radius * 2))
      if (next.length !== liveStrokesRef.current.length) {
        liveStrokesRef.current = next
        eraserDirtyRef.current = true
        paint()
      }
      return
    }
    drawingRef.current = {
      ...drawingRef.current,
      points: [...drawingRef.current.points, pt],
    }
    paint(drawingRef.current)
  }

  const onPointerUp = (e) => {
    if (!drawingRef.current) return
    e.preventDefault()
    const live = drawingRef.current
    drawingRef.current = null
    if (tool === 'eraser') {
      if (eraserDirtyRef.current) onCommit?.([...liveStrokesRef.current])
      eraserDirtyRef.current = false
      return
    }
    if (!live.points?.length) return
    onCommit?.([...liveStrokesRef.current, live])
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 touch-none"
      style={{
        width,
        height,
        cursor: enabled ? (tool === 'eraser' ? 'cell' : 'crosshair') : 'default',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  )
}
