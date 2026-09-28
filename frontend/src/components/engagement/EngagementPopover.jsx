import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const OPEN_DELAY_MS = 150
const CLOSE_DELAY_MS = 220
const PANEL_WIDTH = 320
const GAP = 8

function canHover() {
  return typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
}

/**
 * Kart üzərində kompakt popover.
 * Desktop: hover (kiçik gecikmə ilə). Mobil: status sahəsinə toxunuş. Klaviatura: Enter/Space, Esc bağlayır.
 * Panel body-yə portal ilə çıxarılır: kartların backdrop-filter stacking context-i onu örtməsin.
 * Detallar yalnız ilk açılışda `load()` ilə gətirilir.
 */
export default function EngagementPopover({ trigger, load, children, label }) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState({ loading: false, error: null, data: null })
  const [pos, setPos] = useState(null)
  const rootRef = useRef(null)
  const panelRef = useRef(null)
  const timer = useRef(null)
  const panelId = useId()

  const fetchDetail = useCallback(async () => {
    setState({ loading: true, error: null, data: null })
    try {
      setState({ loading: false, error: null, data: await load() })
    } catch (e) {
      setState({ loading: false, error: e?.message || 'Məlumat yüklənmədi', data: null })
    }
  }, [load])

  const show = useCallback(() => {
    setOpen(true)
    if (!state.data && !state.loading) void fetchDetail()
  }, [fetchDetail, state.data, state.loading])

  const schedule = (fn, ms) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(fn, ms)
  }
  const cancel = () => clearTimeout(timer.current)

  useEffect(() => () => clearTimeout(timer.current), [])

  const place = useCallback(() => {
    const el = rootRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const width = Math.min(PANEL_WIDTH, vw - 16)
    const left = vw < 640 ? 8 : Math.min(Math.max(8, r.right - width), vw - width - 8)
    setPos({ top: r.bottom + GAP, left, width: vw < 640 ? vw - 16 : width })
  }, [])

  useLayoutEffect(() => {
    if (!open) return undefined
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (rootRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const hoverOpen = () => canHover() && schedule(show, OPEN_DELAY_MS)
  const hoverClose = () => canHover() && schedule(() => setOpen(false), CLOSE_DELAY_MS)

  return (
    <div ref={rootRef} className="relative" onMouseEnter={hoverOpen} onMouseLeave={hoverClose}>
      <button
        type="button"
        className="w-full text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        data-engagement-trigger=""
        onClick={() => (open ? setOpen(false) : show())}
      >
        {trigger}
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-label={label}
              onMouseEnter={() => canHover() && cancel()}
              onMouseLeave={hoverClose}
              style={{ top: pos.top, left: pos.left, width: pos.width }}
              className="fixed z-[1300] max-h-[min(70vh,480px)] overflow-y-auto rounded-2xl border border-[color:var(--border-subtle)] bg-token-surfaceCard shadow-2xl p-3 text-token-textMain"
            >
              {state.loading ? (
                <div className="space-y-2 py-2" role="status" aria-label="Yüklənir">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-4 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
                  ))}
                </div>
              ) : state.error ? (
                <div className="py-3 text-center">
                  <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
                  <button
                    type="button"
                    onClick={() => void fetchDetail()}
                    className="mt-2 text-xs font-semibold text-primary hover:underline"
                  >
                    Yenidən cəhd et
                  </button>
                </div>
              ) : state.data ? (
                children(state.data, { refresh: fetchDetail, close: () => setOpen(false) })
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
