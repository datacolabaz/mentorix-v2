import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer = null,
  size = 'md',
  zIndex = 10000,
  scrollBody = false,
}) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  const node = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 sm:p-6 bg-black/75"
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`theme-dark bg-surface-2 border border-white/10 rounded-2xl w-full ${sizes[size]} max-h-[min(90vh,900px)] shadow-2xl flex flex-col overflow-hidden ${
          scrollBody ? '' : 'overflow-y-auto'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between p-6 border-b border-white/10">
          <h2 className="font-display font-700 text-lg text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl"
            aria-label="Bağla"
          >
            ✕
          </button>
        </div>
        <div
          className={
            scrollBody
              ? 'flex-1 min-h-0 overflow-y-auto overscroll-contain [overflow-anchor:none] p-6 text-zinc-200'
              : 'p-6 text-zinc-200'
          }
        >
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-white/10 px-6 py-4 text-zinc-200 bg-surface-2">{footer}</div>
        ) : null}
      </div>
    </div>
  )

  if (typeof document === 'undefined') return node
  return createPortal(node, document.body)
}
