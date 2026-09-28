import { BAR_CLASSES, TONE_CLASSES, initials, progressTone } from '../../lib/engagementCopy'

export function StatusBadge({ meta, className = '' }) {
  if (!meta) return null
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${TONE_CLASSES[meta.tone]} ${className}`}
    >
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  )
}

export function ProgressBar({ pct, label }) {
  const value = Math.max(0, Math.min(100, Number(pct) || 0))
  return (
    <div
      className="h-1.5 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={`h-full rounded-full ${BAR_CLASSES[progressTone(value)]}`} style={{ width: `${value}%` }} />
    </div>
  )
}

const AVATAR_COLORS = ['bg-sky-600', 'bg-emerald-600', 'bg-violet-600', 'bg-amber-600', 'bg-rose-600', 'bg-teal-600']

function colorFor(id) {
  const s = String(id || '')
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function Avatar({ id, name, size = 'sm' }) {
  const dim = size === 'md' ? 'h-8 w-8 text-xs' : 'h-6 w-6 text-[10px]'
  return (
    <span
      title={name}
      className={`inline-flex ${dim} items-center justify-center rounded-full font-bold text-white ring-2 ring-token-surfaceCard ${colorFor(id)}`}
    >
      {initials(name)}
    </span>
  )
}

export function AvatarStack({ people = [], more = 0 }) {
  if (!people.length) return null
  return (
    <div className="flex items-center -space-x-1.5">
      {people.slice(0, 4).map((p) => (
        <Avatar key={p.student_id} id={p.student_id} name={p.full_name} />
      ))}
      {more > 0 ? (
        <span className="inline-flex h-6 min-w-6 px-1 items-center justify-center rounded-full bg-slate-500/20 text-[10px] font-bold text-token-textMain ring-2 ring-token-surfaceCard">
          +{more}
        </span>
      ) : null}
    </div>
  )
}

export function CountChip({ tone, icon, children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[tone]}`}>
      <span aria-hidden="true">{icon}</span>
      {children}
    </span>
  )
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-[color:var(--border-subtle)] p-4 space-y-3 animate-pulse" aria-hidden="true">
      <div className="flex gap-3">
        <div className="h-9 w-9 rounded-xl bg-black/10 dark:bg-white/10" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-2/3 rounded bg-black/10 dark:bg-white/10" />
          <div className="h-3 w-1/3 rounded bg-black/5 dark:bg-white/5" />
        </div>
      </div>
      <div className="h-1.5 rounded bg-black/10 dark:bg-white/10" />
      <div className="h-3 w-1/2 rounded bg-black/5 dark:bg-white/5" />
    </div>
  )
}
