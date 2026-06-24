import { MENTORIX_PRICING_AUDIENCE } from '../../lib/mentorixPublicMarketing'

/** Qiymət kartlarından əvvəl auditoriya izahı — landing (strip) və /qiymetler (faq). */
export default function PricingAudienceExplainer({ variant = 'strip' }) {
  const a = MENTORIX_PRICING_AUDIENCE

  if (variant === 'faq') {
    return (
      <section className="space-y-3" aria-labelledby="mx-pricing-audience-faq">
        <h2 id="mx-pricing-audience-faq" className="text-lg font-semibold text-white">
          {a.sectionTitle}
        </h2>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/10">
          {(a.faq || []).map((item) => (
            <details key={item.q} className="group p-4 sm:p-5">
              <summary className="cursor-pointer text-sm font-semibold text-gray-100 list-none flex items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                <span>{item.q}</span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/45 bg-primary/15 text-primary text-xl font-bold leading-none group-open:rotate-45 transition-transform">
                  +
                </span>
              </summary>
              <p className="mt-3 text-xs sm:text-sm text-gray-400 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section
      className="rounded-2xl border border-white/10 bg-[#121212]/90 p-4 sm:p-5 space-y-4"
      aria-labelledby="mx-pricing-audience-strip"
    >
      <h2 id="mx-pricing-audience-strip" className="text-sm font-semibold text-white">
        {a.sectionTitle}
      </h2>
      <div className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400/90">{a.freeTitle}</div>
        <ul className="space-y-1.5 text-xs sm:text-sm text-gray-300">
          {(a.freeItems || []).map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-emerald-400 shrink-0" aria-hidden>
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed border-t border-white/10 pt-3">{a.footnote}</p>
    </section>
  )
}
