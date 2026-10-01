import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRightIcon } from './icons'
import { PRIMARY_BTN, SECONDARY_BTN } from './HomeHero'

export default function FinalCta({ onPrimary }) {
  const { t } = useTranslation()
  return (
    <section id="mx-cta" aria-labelledby="mx-cta-title">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="rounded-3xl border border-line bg-surface px-6 py-12 text-center shadow-card sm:px-12">
          <h2 id="mx-cta-title" className="text-h2 text-fg">
            {t('home.cta.title')}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-body-lg text-fg-secondary">{t('home.cta.body')}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={onPrimary} className={PRIMARY_BTN}>
              {t('home.cta.primary')}
              <ArrowRightIcon className="h-4 w-4" />
            </button>
            <Link to="/qiymetler" className={SECONDARY_BTN}>
              {t('home.cta.pricing')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
