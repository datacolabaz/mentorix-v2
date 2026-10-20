import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Dialog focus handling: moves focus into the dialog on open, keeps Tab inside it, closes on Escape and
 * returns focus to the element that opened it. `containerRef` points at the dialog panel.
 */
export default function useDialogFocus(open, containerRef, onClose, { enabled = true } = {}) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open || !enabled) return undefined
    const opener = typeof document !== 'undefined' ? document.activeElement : null
    const focusables = () => {
      const root = containerRef.current
      if (!root) return []
      return [...root.querySelectorAll(FOCUSABLE)].filter((el) => !el.closest('[aria-hidden="true"]'))
    }
    const raf = window.requestAnimationFrame(() => {
      const root = containerRef.current
      if (!root || root.contains(document.activeElement)) return
      const auto = root.querySelector('[data-autofocus]')
      const first = auto || focusables()[0] || root
      first?.focus?.()
    })
    const onKey = (e) => {
      const root = containerRef.current
      const active = document.activeElement
      // Another dialog stacked on top (e.g. a confirmation) owns the keyboard.
      if (root && active && !root.contains(active) && active.closest?.('[role="dialog"]')) return
      if (e.key === 'Escape') {
        // Let an open dropdown/menu inside the dialog close first.
        if (e.defaultPrevented) return
        e.stopPropagation()
        onCloseRef.current?.()
        return
      }
      if (e.key !== 'Tab') return
      const list = focusables()
      if (!list.length) return
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        window.requestAnimationFrame(() => opener.focus())
      }
    }
  }, [open, enabled, containerRef])
}
