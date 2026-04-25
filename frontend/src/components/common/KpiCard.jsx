import { ResponsiveContainer, AreaChart, Area } from 'recharts'
import Card from './Card'

function DeltaBadge({ deltaPct }) {
  const n = Number(deltaPct)
  if (!Number.isFinite(n) || n === 0) {
    return (
      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-gray-200/90">
        0%
      </span>
    )
  }
  const up = n > 0
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold tabular-nums',
        up ? 'border-emerald-400/20 bg-emerald-500/12 text-emerald-200' : 'border-red-400/20 bg-red-500/12 text-red-200',
      ].join(' ')}
    >
      <span aria-hidden className="text-[12px] leading-none">
        {up ? '↑' : '↓'}
      </span>
      {Math.abs(n).toFixed(0)}%
    </span>
  )
}

export default function KpiCard({
  title,
  value,
  icon,
  secondary,
  deltaPct,
  sparkline = [],
  className = '',
}) {
  const hasSpark = Array.isArray(sparkline) && sparkline.length >= 2
  const data = hasSpark ? sparkline.map((v, i) => ({ i, v: Number(v) || 0 })) : []

  return (
    <Card hover className={['p-5 min-w-0 overflow-hidden', className].join(' ')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-token-textMuted uppercase tracking-wider mb-2">
            {title}
          </div>
          <div className="font-display font-extrabold text-3xl text-token-textMain tabular-nums">
            {value}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {deltaPct != null ? <DeltaBadge deltaPct={deltaPct} /> : null}
          {icon ? (
            <div className="w-11 h-11 rounded-2xl bg-token-surfaceCard/55 border border-[color:var(--border-subtle)] flex items-center justify-center text-xl">
              {icon}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {secondary ? (
            <div className="text-xs text-token-textMuted leading-snug">
              {secondary}
            </div>
          ) : null}
        </div>

        <div className="w-[120px] h-[34px] shrink-0">
          {hasSpark ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="mentorixSpark" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgba(34,224,136,0.30)" />
                    <stop offset="100%" stopColor="rgba(59,130,246,0.22)" />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="rgba(229,231,235,0.35)"
                  strokeWidth={1.5}
                  fill="url(#mentorixSpark)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full rounded-xl border border-white/10 bg-white/5" />
          )}
        </div>
      </div>
    </Card>
  )
}

