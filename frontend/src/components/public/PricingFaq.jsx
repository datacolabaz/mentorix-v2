import { useTranslation } from 'react-i18next'
import { PlusIcon } from '../landing/icons'

/** Pricing FAQ (/qiymetler): trial, live lessons on Meet/Zoom, limits. */
export default function PricingFaq() {
  const { t } = useTranslation()
  const items = t('landing.pricingPage.faq', { returnObjects: true })
  if (!Array.isArray(items) || !items.length) return null
  return (
    <section className="space-y-3" aria-labelledby="mx-pricing-faq">
      <h2 id="mx-pricing-faq" className="text-h2 text-fg">
        {t('landing.pricingPage.faqHeading')}
      </h2>
      <div className="divide-y divide-line rounded-2xl border border-line bg-surface shadow-card">
        {items.map((item) => (
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
