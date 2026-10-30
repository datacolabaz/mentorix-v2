import { useEffect, useId, useState } from 'react'
import useUiStore from '../../hooks/useUi'

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'

function variantClasses(variant, theme) {
  const light = theme !== 'dark'
  const offset = light ? 'focus-visible:ring-offset-white' : 'focus-visible:ring-offset-black'
  if (variant === 'primary') {
    return [
      'bg-primary text-[#041018]',
      'shadow-[0_8px_24px_rgba(34,224,136,0.18)]',
      'hover:brightness-105 hover:shadow-[0_12px_32px_rgba(34,224,136,0.24)]',
      'active:brightness-95 active:shadow-none',
      FOCUS,
      'focus-visible:ring-primary/45',
      offset,
    ].join(' ')
  }
  if (variant === 'secondary') {
    return light
      ? [
          'bg-white text-slate-900',
          'border border-slate-300',
          'hover:bg-slate-50 hover:border-slate-400',
          'active:bg-slate-100',
          FOCUS,
          'focus-visible:ring-slate-500/35',
          offset,
        ].join(' ')
      : [
          'bg-white/[0.03] text-white',
          'border border-white/20',
          'hover:bg-white/[0.08] hover:border-white/30',
          'active:bg-white/[0.12]',
          FOCUS,
          'focus-visible:ring-white/30',
          offset,
        ].join(' ')
  }
  if (variant === 'ghost') {
    return light
      ? ['bg-transparent text-slate-700', 'hover:text-slate-900 hover:bg-slate-500/10', 'active:bg-slate-500/15', FOCUS, 'focus-visible:ring-slate-500/30', offset].join(' ')
      : ['bg-transparent text-gray-200', 'hover:text-white hover:bg-white/[0.08]', 'active:bg-white/[0.12]', FOCUS, 'focus-visible:ring-white/30', offset].join(' ')
  }
  if (variant === 'danger') {
    return light
      ? ['bg-red-50 text-red-800 border border-red-300', 'hover:bg-red-100', 'active:bg-red-200/70', FOCUS, 'focus-visible:ring-red-500/40', offset].join(' ')
      : ['bg-red-500/20 text-red-300 border border-red-500/40', 'hover:bg-red-500/30', 'active:bg-red-500/40', FOCUS, 'focus-visible:ring-red-400/40', offset].join(' ')
  }
  return ''
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs min-h-[2rem]',
  md: 'px-4 py-2 text-sm min-h-[2.5rem]',
  lg: 'px-6 py-3 text-base min-h-[3rem]',
}

/**
 * Shared button classes — also for links that must look like buttons (e.g. «Analitika»),
 * so every page gets the same normal / hover / pressed / focus / disabled states.
 */
export function buttonClassName({ variant = 'primary', size = 'md', theme = 'light', className = '' } = {}) {
  return [
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold select-none',
    'transition-[box-shadow,background-color,border-color,color,filter,opacity] duration-150 ease-out',
    // Disabled must read as disabled in both themes (not merely a lighter active button).
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:saturate-50 disabled:shadow-none disabled:hover:brightness-100',
    'aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:saturate-50 aria-disabled:shadow-none',
    variantClasses(variant, theme),
    sizes[size] || sizes.md,
    className,
  ].join(' ')
}

/**
 * - `loading`: spinner + «yüklənir» for screen readers; the button is blocked so it cannot be sent twice.
 * - `disabledReason`: the button stays focusable/tappable and explains why it is unavailable
 *   (tooltip on desktop, a short inline note on tap — works on phones where hover does not exist).
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  disabledReason = '',
  className = '',
  onClick,
  ...props
}) {
  const theme = useUiStore((s) => s.theme)
  const reasonId = useId()
  const [showReason, setShowReason] = useState(false)
  const explain = Boolean(disabled && disabledReason && !loading)

  useEffect(() => {
    if (!showReason) return undefined
    const id = window.setTimeout(() => setShowReason(false), 4000)
    return () => window.clearTimeout(id)
  }, [showReason])

  const cls = buttonClassName({ variant, size, theme, className })
  const content = (
    <>
      {loading ? (
        <span className="h-4 w-4 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" />
      ) : null}
      {children}
      {loading ? <span className="sr-only"> — yüklənir</span> : null}
    </>
  )

  if (explain) {
    return (
      <span className="relative inline-flex max-w-full flex-col">
        <button
          {...props}
          className={cls}
          aria-disabled="true"
          aria-describedby={reasonId}
          title={disabledReason}
          onClick={(e) => {
            e.preventDefault()
            setShowReason((v) => !v)
          }}
        >
          {content}
        </button>
        <span id={reasonId} className="sr-only">
          {disabledReason}
        </span>
        {showReason ? (
          <span
            role="status"
            className="absolute left-0 top-full z-[60] mt-1.5 w-max max-w-[min(18rem,80vw)] rounded-lg border border-[color:var(--border-subtle)] bg-token-surfaceCard px-3 py-2 text-xs font-medium text-token-textMain shadow-lg"
          >
            {disabledReason}
          </span>
        ) : null}
      </span>
    )
  }

  return (
    <button {...props} className={cls} disabled={Boolean(loading || disabled)} aria-busy={loading || undefined} onClick={onClick}>
      {content}
    </button>
  )
}
