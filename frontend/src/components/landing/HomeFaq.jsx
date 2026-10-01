import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SectionHeading from './SectionHeading'
import { PlusIcon } from './icons'
import { BRAND } from '../../lib/brand'

export function useHomeFaqItems() {
  const { t } = useTranslation()
  const items = t('home.faq.items', { returnObjects: true, brand: BRAND.name })
  return Array.isArray(items) ? items : []
}

export default function HomeFaq() {
  const { t } = useTranslation()
  const items = useHomeFaqItems()

  return (
    <section id="mx-faq" aria-labelledby="mx-faq-title" className="scroll-mt-20 border-t border-line bg-canvas-subtle">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-20">
        <SectionHeading id="mx-faq-title" title={t('home.faq.title')} />
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {items.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-body font-semibold text-fg hover:bg-canvas-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus [&::-webkit-details-marker]:hidden">
                <h3 className="text-body font-semibold">{item.q}</h3>
                <PlusIcon className="h-5 w-5 shrink-0 text-fg-muted transition-transform group-open:rotate-45" />
              </summary>
              <p className="px-5 pb-5 text-body text-fg-secondary">{item.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-center text-body-sm text-fg-secondary">
          <Link
            to="/qiymetler"
            className="rounded-sm font-semibold text-brand-text underline underline-offset-4 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {t('home.cta.pricing')}
          </Link>
        </p>
      </div>
    </section>
  )
}
