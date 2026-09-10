import { useEffect } from 'react'
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
}) {
  const theme = useUiStore((s) => s.theme)
  const isDark = theme === 'dark'

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
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={[
          isDark ? 'theme-dark' : 'theme-light',
          'rounded-2xl w-full shadow-2xl flex flex-col overflow-hidden',
          sizes[size],
          'max-h-[min(90vh,900px)]',
          isDark
            ? 'bg-surface-2 border border-white/10'
            : 'bg-white border border-slate-200',
          scrollBody ? '' : 'overflow-y-auto',
        ].join(' ')}
        style={{ colorScheme: isDark ? 'dark' : 'light' }}
      >
        <div
          className={[
            'flex shrink-0 items-center justify-between p-6 border-b',
            isDark ? 'border-white/10' : 'border-slate-200',
          ].join(' ')}
        >
          <h2 className={['font-display font-700 text-lg', isDark ? 'text-white' : 'text-slate-900'].join(' ')}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={[
              'transition-colors text-xl',
              isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900',
            ].join(' ')}
            aria-label="Bağla"
          >
            ✕
          </button>
        </div>
        <div
          className={[
            scrollBody
              ? 'flex-1 min-h-0 overflow-y-auto overscroll-contain [overflow-anchor:none] p-6'
              : 'p-6',
            isDark ? 'text-zinc-200' : 'text-slate-800',
          ].join(' ')}
        >
          {children}
        </div>
        {footer ? (
          <div
            className={[
              'shrink-0 border-t px-6 py-4',
              isDark ? 'border-white/10 text-zinc-200 bg-surface-2' : 'border-slate-200 text-slate-800 bg-white',
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
