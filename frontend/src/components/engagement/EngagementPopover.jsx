import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { PRIMARY_TEXT, SUBTLE_BG } from '../../lib/engagementCopy'

const OPEN_DELAY_MS = 150
const CLOSE_DELAY_MS = 220
const PANEL_WIDTH = 340
const GAP = 8
const SHEET_BREAKPOINT = 640
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function canHover() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(hover: hover) and (pointer: fine)').matches)
}

function useSheetMode() {
  const get = () => typeof window !== 'undefined' && (window.innerWidth < SHEET_BREAKPOINT || !canHover())
  const [sheet, setSheet] = useState(get)
  useEffect(() => {
    const onResize = () => setSheet(get())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return sheet
}

/**
 * Kartın status/irəliləyiş sahəsi üçün popover.
 * Desktop: hover (gecikmə ilə) və ya klik; mobil/toxunuş: aşağıdan açılan panel (bottom sheet).
 * Klaviatura: trigger əsl <button>-dur; Enter/Space açır, fokus panelə keçir, Esc bağlayır və fokus trigger-ə qayıdır.
 * Trigger daxilində interaktiv element olmamalıdır (iç-içə düymə/link yoxdur).
 * Panel body-yə portal ilə çıxarılır: kartların backdrop-filter stacking context-i onu örtməsin.
 * Detallar yalnız ilk açılışda `load()` ilə gətirilir.
 */
export default function EngagementPopover({ trigger, load, children, label, triggerClassName = '' }) {
  const { t } = useTranslation()
  const sheet = useSheetMode()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState({ loading: false, error: null, data: null })
  const [pos, setPos] = useState(null)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const timer = useRef(null)
  const focusOnOpen = useRef(false)
  const openedByHover = useRef(false)
  const panelId = useId()
  const titleId = useId()

  const fetchDetail = useCallback(async () => {
    setState({ loading: true, error: null, data: null })
    try {
      setState({ loading: false, error: null, data: await load() })
    } catch (e) {
      setState({ loading: false, error: e?.message || t('activity.common.loadError'), data: null })
    }
  }, [load, t])

  const show = useCallback(
    ({ focus = false } = {}) => {
      focusOnOpen.current = focus
      openedByHover.current = !focus
      setOpen(true)
      if (!state.data && !state.loading) void fetchDetail()
    },
    [fetchDetail, state.data, state.loading],
  )

  const close = useCallback(({ returnFocus = false } = {}) => {
    clearTimeout(timer.current)
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  const schedule = (fn, ms) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(fn, ms)
  }
  const cancel = () => clearTimeout(timer.current)

  useEffect(() => () => clearTimeout(timer.current), [])

  const place = useCallback(() => {
    const el = rootRef.current
    if (!el || sheet) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const width = Math.min(PANEL_WIDTH, vw - 16)
    const left = Math.min(Math.max(8, r.left), vw - width - 8)
    const below = vh - r.bottom
    const top = below < 260 && r.top > below ? null : r.bottom + GAP
    setPos({ top, bottom: top == null ? vh - r.top + GAP : null, left, width })
  }, [sheet])

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
    if (!open || !focusOnOpen.current) return
    focusOnOpen.current = false
    const id = requestAnimationFrame(() => panelRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (rootRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return
      const hadFocus = panelRef.current?.contains(document.activeElement)
      close({ returnFocus: hadFocus })
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        const focusInside = panelRef.current?.contains(document.activeElement) || document.activeElement === triggerRef.current
        close({ returnFocus: sheet || focusInside })
        return
      }
      if (e.key === 'Tab' && sheet && panelRef.current) {
        const items = [...panelRef.current.querySelectorAll(FOCUSABLE)]
        if (!items.length) {
          e.preventDefault()
          return
        }
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, sheet, close])

  /** Desktop: Tab paneldən çıxanda popover bağlanır və fokus trigger-ə qayıdır (sənəd sırası pozulmur). */
  const onPanelBlur = (e) => {
    if (sheet) return
    const next = e.relatedTarget
    if (!next || panelRef.current?.contains(next) || rootRef.current?.contains(next)) return
    close({ returnFocus: true })
  }

  const hoverOpen = () => !sheet && canHover() && !open && schedule(() => show(), OPEN_DELAY_MS)
  const hoverClose = () => !sheet && canHover() && openedByHover.current && schedule(() => close(), CLOSE_DELAY_MS)

  /** Hover ilə açılmış popover-ə klik onu bağlamır: sabitləyir və fokusu panelə keçirir. */
  const onTriggerClick = () => {
    cancel()
    if (!open) {
      show({ focus: true })
      return
    }
    if (openedByHover.current) {
      openedByHover.current = false
      panelRef.current?.focus()
      return
    }
    close()
  }

  const body = state.loading ? (
    <div className="space-y-2 py-2" role="status" aria-label={t('activity.common.loading')}>
      {[0, 1, 2].map((i) => (
        <div key={i} className={`h-4 rounded ${SUBTLE_BG} animate-pulse`} />
      ))}
    </div>
  ) : state.error ? (
    <div className="py-3 text-center">
      <p className="text-sm text-red-700 [.theme-dark_&]:text-red-300">{state.error}</p>
      <button
        type="button"
        onClick={() => void fetchDetail()}
        className={`mt-2 rounded text-xs font-semibold ${PRIMARY_TEXT} hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60`}
      >
        {t('activity.common.retry')}
      </button>
    </div>
  ) : state.data ? (
    children(state.data, { refresh: fetchDetail, close: () => close({ returnFocus: true }) })
  ) : null

  return (
    <div ref={rootRef} className="relative min-w-0" onMouseEnter={hoverOpen} onMouseLeave={hoverClose}>
      <button
        ref={triggerRef}
        type="button"
        className={`w-full text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${triggerClassName}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        data-engagement-trigger=""
        onClick={onTriggerClick}
      >
        <span className="sr-only">{label}. </span>
        {trigger}
      </button>
      {open && (sheet || pos)
        ? createPortal(
            <>
              {sheet ? (
                <div className="fixed inset-0 z-[1299] bg-black/40" aria-hidden="true" onClick={() => close({ returnFocus: true })} />
              ) : null}
              <div
                ref={panelRef}
                id={panelId}
                role="dialog"
                aria-modal={sheet ? 'true' : undefined}
                aria-labelledby={titleId}
                tabIndex={-1}
                onBlur={onPanelBlur}
                onMouseEnter={() => !sheet && canHover() && cancel()}
                onMouseLeave={hoverClose}
                style={sheet ? undefined : { top: pos.top ?? undefined, bottom: pos.bottom ?? undefined, left: pos.left, width: pos.width }}
                className={`fixed z-[1300] overflow-y-auto border border-[color:var(--border-subtle)] bg-token-surfaceCard text-token-textMain shadow-2xl focus:outline-none ${
                  sheet
                    ? 'inset-x-0 bottom-0 max-h-[80vh] rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]'
                    : 'max-h-[min(70vh,480px)] rounded-2xl p-3'
                }`}
              >
                {sheet ? <div className={`mx-auto mb-3 h-1 w-10 rounded-full ${SUBTLE_BG}`} aria-hidden="true" /> : null}
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p id={titleId} className="min-w-0 break-words text-xs font-semibold text-token-textMuted">
                    {label}
                  </p>
                  {sheet ? (
                    <button
                      type="button"
                      onClick={() => close({ returnFocus: true })}
                      className="shrink-0 rounded-lg px-2 py-0.5 text-sm font-semibold text-token-textMuted hover:text-token-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                      aria-label={t('activity.common.close')}
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
                {body}
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  )
}
