import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import api from '../lib/api'

const TOOL_DEFAULTS = {
  pen: { color: '#111827', width: 2.5, opacity: 1 },
  highlighter: { color: '#facc15', width: 18, opacity: 0.35 },
  eraser: { color: '#111827', width: 16, opacity: 1 },
}

function cloneStrokes(strokes) {
  return Array.isArray(strokes) ? strokes.map((s) => ({ ...s, points: [...(s.points || [])] })) : []
}

export default function usePresentationAnnotations(presentationId, initialMap) {
  const [bySlide, setBySlide] = useState(() => initialMap && typeof initialMap === 'object' ? { ...initialMap } : {})
  const [tool, setTool] = useState('pen')
  const historyRef = useRef({})
  const dirtyRef = useRef(new Set())
  const timerRef = useRef(null)

  useEffect(() => {
    setBySlide(initialMap && typeof initialMap === 'object' ? { ...initialMap } : {})
    historyRef.current = {}
    dirtyRef.current = new Set()
  }, [presentationId, initialMap])

  const persistSlide = useCallback(
    async (slideIndex, strokes) => {
      if (!presentationId) return
      try {
        await api.put(`/presentations/${presentationId}/annotations`, {
          slide_index: slideIndex,
          strokes,
        })
      } catch {
        /* keep local strokes; next edit retries */
      }
    },
    [presentationId],
  )

  const flushDirty = useCallback(() => {
    if (!dirtyRef.current.size) return
    const pending = [...dirtyRef.current]
    dirtyRef.current = new Set()
    for (const idx of pending) {
      void persistSlide(idx, bySlide[String(idx)] || [])
    }
  }, [bySlide, persistSlide])

  useEffect(() => {
    if (!dirtyRef.current.size) return undefined
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flushDirty, 400)
    return () => clearTimeout(timerRef.current)
  }, [bySlide, flushDirty])

  useEffect(() => () => {
    clearTimeout(timerRef.current)
  }, [])

  const pushHistory = useCallback((slideIndex, previous) => {
    const key = String(slideIndex)
    if (!historyRef.current[key]) historyRef.current[key] = { past: [], future: [] }
    historyRef.current[key].past.push(cloneStrokes(previous))
    if (historyRef.current[key].past.length > 80) historyRef.current[key].past.shift()
    historyRef.current[key].future = []
  }, [])

  const setSlideStrokes = useCallback((slideIndex, next, { recordHistory = true } = {}) => {
    const key = String(slideIndex)
    setBySlide((prev) => {
      const previous = prev[key] || []
      if (recordHistory) pushHistory(slideIndex, previous)
      dirtyRef.current.add(slideIndex)
      return { ...prev, [key]: next }
    })
  }, [pushHistory])

  const strokesFor = useCallback((slideIndex) => bySlide[String(slideIndex)] || [], [bySlide])

  const canUndo = useCallback((slideIndex) => Boolean(historyRef.current[String(slideIndex)]?.past?.length), [bySlide])
  const canRedo = useCallback((slideIndex) => Boolean(historyRef.current[String(slideIndex)]?.future?.length), [bySlide])

  const undo = useCallback((slideIndex) => {
    const key = String(slideIndex)
    const hist = historyRef.current[key]
    if (!hist?.past?.length) return
    const previous = hist.past.pop()
    setBySlide((prev) => {
      hist.future.push(cloneStrokes(prev[key] || []))
      dirtyRef.current.add(slideIndex)
      return { ...prev, [key]: previous }
    })
  }, [])

  const redo = useCallback((slideIndex) => {
    const key = String(slideIndex)
    const hist = historyRef.current[key]
    if (!hist?.future?.length) return
    const next = hist.future.pop()
    setBySlide((prev) => {
      hist.past.push(cloneStrokes(prev[key] || []))
      dirtyRef.current.add(slideIndex)
      return { ...prev, [key]: next }
    })
  }, [])

  const clearSlide = useCallback((slideIndex) => {
    setSlideStrokes(slideIndex, [])
  }, [setSlideStrokes])

  const defaults = useMemo(() => TOOL_DEFAULTS[tool] || TOOL_DEFAULTS.pen, [tool])

  return {
    tool,
    setTool,
    defaults,
    strokesFor,
    setSlideStrokes,
    undo,
    redo,
    canUndo,
    canRedo,
    clearSlide,
    flushDirty,
  }
}
