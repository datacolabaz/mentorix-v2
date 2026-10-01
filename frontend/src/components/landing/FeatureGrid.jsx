import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SectionHeading from './SectionHeading'
import { ArrowRightIcon, BadgeCheckIcon, ChartIcon, CheckCircleIcon, CommentIcon, QrIcon, SparklesIcon } from './icons'

const FEATURE_META = {
  ai: { Icon: SparklesIcon, to: '/muellimler-ucun' },
  grading: { Icon: CheckCircleIcon, to: '/imtahanlar' },
  join: { Icon: QrIcon, to: '/imtahanlar' },
  results: { Icon: ChartIcon, to: '/muellimler-ucun' },
  review: { Icon: CommentIcon, to: '/tapshiriqlar' },
  certificate: { Icon: BadgeCheckIcon, to: '/sertifikatli-imtahanlar' },
}

export default function FeatureGrid() {
  const { t } = useTranslation()
  const items = t('home.features.items', { returnObjects: true })
  const features = Array.isArray(items) ? items : []

  return (
    <section id="mx-features" aria-labelledby="mx-features-title" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <SectionHeading id="mx-features-title" kicker={t('home.features.kicker')} title={t('home.features.title')} />
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((item) => {
            const meta = FEATURE_META[item.id] || FEATURE_META.ai
            const { Icon } = meta
            return (
              <li
                key={item.id}
                className="flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-card transition-colors hover:border-line-strong"
              >
                <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-subtle text-brand-text">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="text-h3 text-fg">{item.title}</h3>
                <p className="mt-2 text-body text-fg-secondary">{item.body}</p>
                <p className="mt-3 text-body-sm font-medium text-fg">{item.benefit}</p>
                <Link
                  to={meta.to}
                  className="mt-auto inline-flex items-center gap-1.5 self-start rounded-sm pt-4 text-body-sm font-semibold text-brand-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {t('home.features.learnMore')}
                  <span className="sr-only">: {item.title}</span>
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
