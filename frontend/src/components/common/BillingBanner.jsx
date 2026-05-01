import Button from './Button'

const stylesByStatus = {
  warning: {
    wrap: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
    title: 'Diqqət',
  },
  blocked: {
    wrap: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
    title: 'Məhdudiyyət',
  },
  expired: {
    wrap: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
    title: 'Trial bitdi',
  },
  active: null,
}

export default function BillingBanner({ status, banner, cta, onCta }) {
  const s = String(status || 'active')
  const meta = stylesByStatus[s]
  if (!meta) return null
  if (!banner && !cta) return null

  return (
    <div className={`rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${meta.wrap}`}>
      <div className="min-w-0">
        <div className="text-xs font-bold uppercase tracking-wide opacity-90">{meta.title}</div>
        <div className="text-sm font-semibold break-words">{banner || '—'}</div>
      </div>
      {cta ? (
        <Button variant={s === 'warning' ? 'secondary' : 'primary'} size="sm" onClick={onCta}>
          {cta}
        </Button>
      ) : null}
    </div>
  )
}

