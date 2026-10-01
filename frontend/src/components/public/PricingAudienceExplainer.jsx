import { MENTORIX_PRICING_AUDIENCE } from '../../lib/mentorixPublicMarketing'
import { CheckIcon, PlusIcon } from '../landing/icons'

/** Qiymət kartlarından əvvəl auditoriya izahı — landing (strip) və /qiymetler (faq). */
export default function PricingAudienceExplainer({ variant = 'strip' }) {
  const a = MENTORIX_PRICING_AUDIENCE

  if (variant === 'faq') {
    return (
      <section className="space-y-3" aria-labelledby="mx-pricing-audience-faq">
        <h2 id="mx-pricing-audience-faq" className="text-h2 text-fg">
          {a.sectionTitle}
        </h2>
        <div className="divide-y divide-line rounded-2xl border border-line bg-surface shadow-card">
          {(a.faq || []).map((item) => (
            <details key={item.q} className="group p-4 sm:p-5">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-body font-semibold text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-details-marker]:hidden">
                <span>{item.q}</span>
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-brand-subtle text-brand-text transition-transform group-open:rotate-45"
                >
                  <PlusIcon className="h-4 w-4" />
                </span>
              </summary>
              <p className="mt-3 max-w-measure text-body-sm leading-relaxed text-fg-secondary sm:text-body">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-card" aria-labelledby="mx-pricing-audience-strip">
      <h2 id="mx-pricing-audience-strip" className="text-body font-semibold text-fg">
        {a.sectionTitle}
      </h2>
      <div className="space-y-2">
        <div className="text-caption font-semibold uppercase tracking-wide text-brand-text">{a.freeTitle}</div>
        <ul className="space-y-1.5 text-body-sm text-fg-secondary sm:text-body">
          {(a.freeItems || []).map((item) => (
            <li key={item} className="flex gap-2">
              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-text" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="border-t border-line pt-3 text-body-sm leading-relaxed text-fg-muted">{a.footnote}</p>
    </section>
  )
}
