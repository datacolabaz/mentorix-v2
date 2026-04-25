import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

export default function PortalMenu({
  open,
  onClose,
  anchorRef,
  align = 'end', // start | end
  sideOffset = 8,
  width = 224, // px
  children,
}) {
  const menuRef = useRef(null)
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const portalRoot = useMemo(() => {
    if (typeof document === 'undefined') return null
    return document.body
  }, [])

  useEffect(() => {
    if (!open) return
    setMounted(true)
    return () => setMounted(false)
  }, [open])

  const computePosition = () => {
    const el = anchorRef?.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    const estimatedH = menuRef.current?.offsetHeight || 180
    const preferTop = r.bottom + sideOffset
    const preferBottom = r.top - sideOffset - estimatedH
    const top = preferTop + estimatedH <= vh ? preferTop : Math.max(8, preferBottom)

    const leftRaw = align === 'start' ? r.left : r.right - width
    const left = clamp(leftRaw, 8, Math.max(8, vw - width - 8))

    setPos({ top, left })
  }

  useLayoutEffect(() => {
    if (!open) return
    computePosition()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return

    const onDocDown = (e) => {
      const menuEl = menuRef.current
      const anchorEl = anchorRef?.current
      const t = e.target
      if (!menuEl || !t) return
      if (menuEl.contains(t)) return
      if (anchorEl && anchorEl.contains(t)) return
      onClose?.()
    }

    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }

    const onWin = () => computePosition()

    document.addEventListener('mousedown', onDocDown, true)
    document.addEventListener('touchstart', onDocDown, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onWin)
    window.addEventListener('scroll', onWin, true)

    return () => {
      document.removeEventListener('mousedown', onDocDown, true)
      document.removeEventListener('touchstart', onDocDown, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onWin)
      window.removeEventListener('scroll', onWin, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose])

  if (!open || !mounted || !portalRoot) return null

  return createPortal(
    <div className="fixed inset-0 z-[90] pointer-events-none">
      <div
        ref={menuRef}
        className={[
          'pointer-events-auto',
          'absolute',
          'rounded-2xl border overflow-hidden',
          'border-[color:var(--border-subtle)] bg-token-surfaceCard/90 backdrop-blur-[10px]',
          'shadow-[0_18px_45px_rgba(0,0,0,0.35)]',
          'w-[224px]',
          'transition-[opacity,transform] duration-200 ease-out',
          'opacity-100 translate-y-0',
          'animate-[mxFadeIn_.16s_ease-out]',
        ].join(' ')}
        style={{ top: pos.top, left: pos.left }}
        role="menu"
      >
        {children}
      </div>
    </div>,
    portalRoot
  )
}

