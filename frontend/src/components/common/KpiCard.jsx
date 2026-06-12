import { useId } from 'react'
import { Link } from 'react-router-dom'
import { ResponsiveContainer, AreaChart, Area } from 'recharts'
import Card from './Card'
import useUiStore from '../../hooks/useUi'

function DeltaBadge({ deltaPct, theme }) {
  const n = Number(deltaPct)
  const light = theme !== 'dark'
  if (!Number.isFinite(n) || n === 0) {
    return (
      <span
        className={[
          'inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold',
          light
            ? 'border-slate-300/80 bg-slate-100 text-slate-700'
            : 'border-white/10 bg-white/5 text-gray-200/90',
        ].join(' ')}
      >
        0%
      </span>
    )
  }
  const up = n > 0
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold tabular-nums',
        up
          ? light
            ? 'border-emerald-600/25 bg-emerald-50 text-emerald-800'
            : 'border-emerald-400/20 bg-emerald-500/12 text-emerald-200'
          : light
            ? 'border-red-500/25 bg-red-50 text-red-800'
            : 'border-red-400/20 bg-red-500/12 text-red-200',
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
  to,
  ariaLabel,
}) {
  const theme = useUiStore((s) => s.theme)
  const sparkFillId = useId().replace(/:/g, '')
  const hasSpark = Array.isArray(sparkline) && sparkline.length >= 2
  const data = hasSpark ? sparkline.map((v, i) => ({ i, v: Number(v) || 0 })) : []

  const label =
    ariaLabel ||
    (to ? `${title}: ətraflı baxış üçün keçid` : undefined)

  const inner = (
    <>
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
          {deltaPct != null ? <DeltaBadge deltaPct={deltaPct} theme={theme} /> : null}
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

        <div className="hidden sm:block w-[120px] h-[34px] shrink-0 overflow-hidden min-w-0 max-w-[38%]">
          {hasSpark ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={sparkFillId} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgba(34,224,136,0.30)" />
                    <stop offset="100%" stopColor="rgba(59,130,246,0.22)" />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="rgba(229,231,235,0.35)"
                  strokeWidth={1.5}
                  fill={'url(#' + sparkFillId + ')'}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div
              className={[
                'h-full rounded-xl border',
                theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200/80 bg-slate-100/80',
              ].join(' ')}
            />
          )}
        </div>
      </div>
    </>
  )

  const cardClass = ['p-4 sm:p-5 min-w-0 w-full max-w-full overflow-hidden box-border', className].join(' ')

  if (to) {
    return (
      <Link
        to={to}
        aria-label={label}
        className="block h-full min-w-0 max-w-full rounded-2xl no-underline text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55"
      >
        <Card hover className={`${cardClass} h-full`}>
          {inner}
        </Card>
      </Link>
    )
  }

  return <Card hover className={cardClass}>{inner}</Card>
}
