import Button from './Button'

const stylesByStatus = {
  warning: {
    wrap: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
    title: 'Diqqət',
  },
  grace: {
    wrap: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
    title: 'Ödəniş gecikib',
  },
  blocked: {
    wrap: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
    title: 'Limit',
  },
  expired: {
    wrap: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
    title: 'Abunəlik',
  },
  active: null,
}

export default function BillingBanner({ status, banner, cta, onCta }) {
  const s = String(status || 'active')
  const meta = stylesByStatus[s]
  if (!meta) return null
  if (!banner && !cta) return null
  const ctaLabel = cta && typeof cta === 'object' ? cta.label : cta

  return (
    <div className={`rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${meta.wrap}`}>
      <div className="min-w-0">
        <div className="text-xs font-bold uppercase tracking-wide opacity-90">{meta.title}</div>
        <div className="text-sm font-semibold break-words">{banner || '—'}</div>
      </div>
      {ctaLabel ? (
        <Button variant={s === 'warning' ? 'secondary' : 'primary'} size="sm" onClick={onCta}>
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  )
}

