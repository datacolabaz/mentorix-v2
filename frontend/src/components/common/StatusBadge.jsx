// Theme-aware status colours (design tokens), always paired with a text label — never colour alone.
const STYLES = {
  paid: 'bg-success-subtle text-success border-success/25',
  due: 'bg-warning-subtle text-warning border-warning/25',
  pending: 'bg-info-subtle text-info border-info/25',
  danger: 'bg-error-subtle text-error border-error/25',
  neutral: 'bg-canvas-subtle text-token-textMuted border-[color:var(--border-subtle)]',
}

export default function StatusBadge({ variant = 'neutral', children, className = '' }) {
  const v = STYLES[variant] || STYLES.neutral
  return (
    <span className={['inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide', v, className].join(' ')}>
      {children}
    </span>
  )
}
