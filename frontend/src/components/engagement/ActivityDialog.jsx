import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Modal dialoq: role="dialog" + aria-modal, fokus içəridə saxlanılır, Esc bağlayır (busy olmadıqda),
 * bağlananda fokus dialoqu açan elementə qayıdır. Mobil ekranda aşağıdan açılır.
 */
export default function ActivityDialog({ open, title, onClose, busy = false, children, footer }) {
  const { t } = useTranslation()
  const panelRef = useRef(null)
  const openerRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return undefined
    openerRef.current = document.activeElement
    const id = requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector(FOCUSABLE)
      ;(first || panelRef.current)?.focus()
    })
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      cancelAnimationFrame(id)
      document.body.style.overflow = prevOverflow
      const opener = openerRef.current
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        if (!busy) onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
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
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, busy, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[1400] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={() => !busy && onClose()} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[color:var(--border-subtle)] bg-token-surfaceCard text-token-textMain shadow-2xl focus:outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--border-subtle)] px-5 py-4">
          <h2 id={titleId} className="min-w-0 break-words font-display text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t('activity.common.close')}
            className="shrink-0 rounded-lg px-2 py-0.5 text-token-textMuted hover:text-token-textMain disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[color:var(--border-subtle)] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
