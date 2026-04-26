import { useId, useMemo } from 'react'

export default function Tooltip({ content, children, side = 'top', align = 'center', className = '' }) {
  const id = useId()
  const pos = useMemo(() => {
    const sideCls =
      side === 'bottom'
        ? 'top-full mt-2'
        : side === 'left'
          ? 'right-full mr-2'
          : side === 'right'
            ? 'left-full ml-2'
            : 'bottom-full mb-2'
    const alignCls =
      align === 'start'
        ? 'left-0'
        : align === 'end'
          ? 'right-0'
          : side === 'left' || side === 'right'
            ? 'top-1/2 -translate-y-1/2'
            : 'left-1/2 -translate-x-1/2'
    return `${sideCls} ${alignCls}`
  }, [side, align])

  if (!content) return children

  return (
    <span className={['relative inline-flex group', className].join(' ')} aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className={[
          'pointer-events-none absolute z-[80] hidden group-hover:block group-focus-within:block',
          pos,
          'min-w-[220px] max-w-[320px]',
          'rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/95 backdrop-blur-[10px]',
          'px-3 py-2 text-xs text-token-textMain shadow-[0_16px_40px_rgba(0,0,0,0.22)]',
        ].join(' ')}
      >
        {typeof content === 'string' ? <span className="leading-relaxed">{content}</span> : content}
      </span>
    </span>
  )
}

