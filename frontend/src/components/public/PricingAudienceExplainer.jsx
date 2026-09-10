import { MENTORIX_PRICING_AUDIENCE } from '../../lib/mentorixPublicMarketing'

/** Qiymət kartlarından əvvəl auditoriya izahı — landing (strip) və /qiymetler (faq). */
export default function PricingAudienceExplainer({ variant = 'strip' }) {
  const a = MENTORIX_PRICING_AUDIENCE

  if (variant === 'faq') {
    return (
      <section className="space-y-3" aria-labelledby="mx-pricing-audience-faq">
        <h2 id="mx-pricing-audience-faq" className="text-2xl font-bold text-slate-900">
          {a.sectionTitle}
        </h2>
        <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-sm">
          {(a.faq || []).map((item) => (
            <details key={item.q} className="group p-4 sm:p-5">
              <summary className="cursor-pointer text-base font-semibold text-slate-900 list-none flex items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                <span>{item.q}</span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xl font-bold leading-none group-open:rotate-45 transition-transform">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm"
      aria-labelledby="mx-pricing-audience-strip"
    >
      <h2 id="mx-pricing-audience-strip" className="text-base font-semibold text-slate-900">
        {a.sectionTitle}
      </h2>
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">{a.freeTitle}</div>
        <ul className="space-y-1.5 text-sm sm:text-base text-slate-700">
          {(a.freeItems || []).map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-emerald-600 shrink-0" aria-hidden>
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-sm text-slate-500 leading-relaxed border-t border-slate-100 pt-3">{a.footnote}</p>
    </section>
  )
}
