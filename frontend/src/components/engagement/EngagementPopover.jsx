import { useCallback, useEffect, useId, useRef, useState } from 'react'

const OPEN_DELAY_MS = 150
const CLOSE_DELAY_MS = 220

function canHover() {
  return typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
}

/**
 * Kart üzərində kompakt popover.
 * Desktop: hover (kiçik gecikmə ilə). Mobil: status sahəsinə toxunuş. Klaviatura: Enter/Space, Esc bağlayır.
 * Detallar yalnız ilk açılışda `load()` ilə gətirilir.
 */
export default function EngagementPopover({ trigger, load, children, label }) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState({ loading: false, error: null, data: null })
  const rootRef = useRef(null)
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

  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
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

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => canHover() && schedule(show, OPEN_DELAY_MS)}
      onMouseLeave={() => canHover() && schedule(() => setOpen(false), CLOSE_DELAY_MS)}
    >
      <button
        type="button"
        className="w-full text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : show())}
      >
        {trigger}
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          className="absolute z-40 left-0 right-0 sm:left-auto sm:right-0 sm:w-80 top-full mt-2 rounded-2xl border border-[color:var(--border-subtle)] bg-token-surfaceCard shadow-2xl p-3 text-token-textMain"
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
              <button type="button" onClick={() => void fetchDetail()} className="mt-2 text-xs font-semibold text-primary hover:underline">
                Yenidən cəhd et
              </button>
            </div>
          ) : state.data ? (
            children(state.data, { refresh: fetchDetail, close: () => setOpen(false) })
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
