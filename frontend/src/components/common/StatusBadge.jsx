const STYLES = {
  paid: 'bg-emerald-500/12 text-emerald-200 border-emerald-400/20',
  due: 'bg-amber-500/12 text-amber-200 border-amber-400/20',
  pending: 'bg-sky-500/12 text-sky-200 border-sky-400/20',
  danger: 'bg-red-500/12 text-red-200 border-red-400/20',
  neutral: 'bg-white/5 text-gray-200 border-white/10',
}

export default function StatusBadge({ variant = 'neutral', children, className = '' }) {
  const v = STYLES[variant] || STYLES.neutral
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide',
        'backdrop-blur-[6px]',
        v,
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}

