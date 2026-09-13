import { moneyLocale as moneyLocaleTag } from '../../lib/uiLocale'

/** Clean SaaS-style KPI metric number (body sans, semibold, tabular). */
export default function KpiValue({ children, className = '' }) {
  return (
    <div
      className={[
        'font-body font-semibold text-2xl sm:text-3xl text-token-textMain tabular-nums tracking-normal leading-tight min-w-0 break-words',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}

/**
 * AZN amount for KPI cards: muted, slightly smaller ₼ so digits stay primary.
 * Renders e.g. ₼10,730
 */
export function KpiAznAmount({ amount, locale, className = '' }) {
  const loc = locale || moneyLocaleTag('az')
  const n = Math.round(Number(amount) || 0)
  const formatted = new Intl.NumberFormat(loc).format(Number.isFinite(n) ? n : 0)

  return (
    <span
      className={['inline-flex items-baseline gap-x-0.5 tabular-nums', className].filter(Boolean).join(' ')}
      aria-label={`${formatted} AZN`}
    >
      <span className="text-[0.8em] opacity-75 font-semibold leading-none" aria-hidden="true">
        ₼
      </span>
      <span className="leading-none" aria-hidden="true">
        {formatted}
      </span>
    </span>
  )
}
