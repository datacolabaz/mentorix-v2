import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import useUiStore from '../../hooks/useUi'

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer = null,
  size = 'md',
  zIndex = 10000,
  scrollBody = false,
  compact = false,
  closeLabel = 'Close',
}) {
  const theme = useUiStore((s) => s.theme)
  const isDark = theme === 'dark'
  const titleId = useId()

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  const node = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 sm:p-6 bg-black/50"
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : closeLabel}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={[
          isDark ? 'theme-dark' : 'theme-light',
          'rounded-2xl w-full shadow-2xl flex flex-col overflow-hidden',
          sizes[size],
          'max-h-[min(90vh,900px)]',
          'bg-surface-elevated border border-line text-fg',
          scrollBody ? '' : 'overflow-y-auto',
        ].join(' ')}
        style={{ colorScheme: isDark ? 'dark' : 'light' }}
      >
        <div
          className={[
            'flex shrink-0 items-center justify-between border-b border-line',
            compact ? 'px-5 py-4' : 'p-6',
          ].join(' ')}
        >
          <h2 id={titleId} className="font-display font-700 text-lg text-fg">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg text-xl text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            aria-label={closeLabel}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div
          className={[
            scrollBody
              ? `flex-1 min-h-0 overflow-y-auto overscroll-contain [overflow-anchor:none] ${compact ? 'p-5' : 'p-6'}`
              : compact ? 'p-5' : 'p-6',
            'text-fg',
          ].join(' ')}
        >
          {children}
        </div>
        {footer ? (
          <div
            className={[
              'shrink-0 border-t border-line bg-surface-elevated text-fg',
              compact ? 'px-5 py-3' : 'px-6 py-4',
            ].join(' ')}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )

  if (typeof document === 'undefined') return node
  return createPortal(node, document.body)
}
