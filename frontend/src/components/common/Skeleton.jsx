export default function Skeleton({ className = '' }) {
  return (
    <div
      className={[
        'animate-pulse rounded-xl',
        'bg-white/5',
        'border border-white/10',
        className,
      ].join(' ')}
      aria-hidden
    />
  )
}

