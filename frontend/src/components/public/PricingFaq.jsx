import { useTranslation } from 'react-i18next'

/** Pricing FAQ (/qiymetler): trial, live lessons on Meet/Zoom, limits. */
export default function PricingFaq() {
  const { t } = useTranslation()
  const items = t('landing.pricingPage.faq', { returnObjects: true })
  if (!Array.isArray(items) || !items.length) return null
  return (
    <section className="space-y-3" aria-labelledby="mx-pricing-faq">
      <h2 id="mx-pricing-faq" className="text-2xl font-bold text-slate-900">
        {t('landing.pricingPage.faqHeading')}
      </h2>
      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
        {items.map((item) => (
          <details key={item.q} className="group p-4 sm:p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 [&::-webkit-details-marker]:hidden">
              <span>{item.q}</span>
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-xl font-bold leading-none text-emerald-700 transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
