import Button from './Button'
import useUiStore from '../../hooks/useUi'

function stylesByStatus(theme) {
  const light = theme !== 'dark'
  return {
    warning: {
      wrap: light
        ? 'border-amber-600/30 bg-amber-50 text-amber-950'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-100',
      title: 'Diqqət',
      ctaClass: light
        ? '!text-amber-950 !border-amber-700/30 hover:!bg-amber-100/70'
        : '',
    },
    grace: {
      wrap: light
        ? 'border-amber-600/30 bg-amber-50 text-amber-950'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-100',
      title: 'Ödəniş gecikib',
      ctaClass: light
        ? '!text-amber-950 !border-amber-700/30 hover:!bg-amber-100/70'
        : '',
    },
    blocked: {
      wrap: light
        ? 'border-rose-600/30 bg-rose-50 text-rose-950'
        : 'border-rose-500/30 bg-rose-500/10 text-rose-100',
      title: 'Limit',
      ctaClass: '',
    },
    expired: {
      wrap: light
        ? 'border-rose-600/30 bg-rose-50 text-rose-950'
        : 'border-rose-500/30 bg-rose-500/10 text-rose-100',
      title: 'Abunəlik',
      ctaClass: '',
    },
    pending: {
      wrap: light
        ? 'border-sky-600/25 bg-sky-50 text-sky-950'
        : 'border-sky-500/30 bg-sky-500/10 text-sky-100',
      title: 'Ödəniş gözləmədədir',
      ctaClass: light
        ? '!text-sky-950 !border-sky-700/30 hover:!bg-sky-100/70'
        : '',
    },
    active: null,
  }
}

export default function BillingBanner({ status, banner, cta, onCta, tone }) {
  const { theme } = useUiStore()
  const s = tone === 'pending' ? 'pending' : String(status || 'active')
  const meta = stylesByStatus(theme)[s]
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
        <Button
          variant={s === 'warning' || s === 'grace' ? 'secondary' : 'primary'}
          size="sm"
          onClick={onCta}
          className={meta.ctaClass || ''}
        >
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  )
}

