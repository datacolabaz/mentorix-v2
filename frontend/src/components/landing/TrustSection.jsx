import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SectionHeading from './SectionHeading'
import { BadgeCheckIcon, LockIcon, SupportIcon } from './icons'
import { TRUST_CONTENT } from '../../config/trustContent'
import { MENTORIX_CONTACT } from '../../lib/mentorixPublicMarketing'
import { BRAND } from '../../lib/brand'

const INLINE_LINK =
  'rounded-sm font-semibold text-brand-text underline underline-offset-4 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus'

const SHOW_PLACEHOLDERS = import.meta.env.DEV && import.meta.env.MODE !== 'test'

function PlaceholderSlots() {
  const { t } = useTranslation()
  const slots = ['testimonials', 'stats', 'logos', 'stories', 'team']
  return (
    <div className="mt-10 rounded-2xl border-2 border-dashed border-warning/60 bg-warning-subtle p-5" data-testid="trust-placeholders">
      <p className="text-body-sm font-semibold text-warning">{t('home.trust.placeholders.badge')}</p>
      <p className="mt-1 text-body-sm text-fg-secondary">{t('home.trust.placeholders.note')}</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((slot) => (
          <li key={slot} className="rounded-lg border border-dashed border-line-strong bg-surface px-3 py-2 text-body-sm text-fg-secondary">
            {t(`home.trust.placeholders.${slot}`)}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ConfirmedSocialProof() {
  const { stats, testimonials, logos } = TRUST_CONTENT
  if (!stats.length && !testimonials.length && !logos.length) return null
  return (
    <div className="mt-10 space-y-8">
      {stats.length ? (
        <dl className="grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-line bg-surface p-5 text-center">
              <dt className="text-body-sm text-fg-secondary">{s.label}</dt>
              <dd className="m-0 mt-1 text-h2 text-fg">{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {testimonials.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {testimonials.map((item) => (
            <li key={item.name} className="rounded-2xl border border-line bg-surface p-6">
              <blockquote className="m-0 text-body text-fg">“{item.quote}”</blockquote>
              <p className="mt-4 text-body-sm font-semibold text-fg">{item.name}</p>
              <p className="text-caption text-fg-muted">{[item.role, item.organization].filter(Boolean).join(' · ')}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {logos.length ? (
        <ul className="flex flex-wrap items-center justify-center gap-8">
          {logos.map((logo) => (
            <li key={logo.name}>
              <img src={logo.src} alt={logo.name} className="h-8 w-auto" loading="lazy" decoding="async" />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export default function TrustSection() {
  const { t } = useTranslation()

  return (
    <section id="mx-trust" aria-labelledby="mx-trust-title" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <SectionHeading id="mx-trust-title" kicker={t('home.trust.kicker')} title={t('home.trust.title')} />
        <ul className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <li className="rounded-2xl border border-line bg-surface p-6 shadow-card">
            <LockIcon className="mb-4 h-7 w-7 text-brand-text" />
            <h3 className="text-h3 text-fg">{t('home.trust.items.privacy.title')}</h3>
            <p className="mt-2 text-body text-fg-secondary">{t('home.trust.items.privacy.body')}</p>
            <p className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-body-sm">
              <Link to="/privacy" className={INLINE_LINK}>
                {t('home.trust.items.privacy.privacy')}
              </Link>
              <Link to="/terms" className={INLINE_LINK}>
                {t('home.trust.items.privacy.terms')}
              </Link>
            </p>
          </li>
          <li className="rounded-2xl border border-line bg-surface p-6 shadow-card">
            <BadgeCheckIcon className="mb-4 h-7 w-7 text-brand-text" />
            <h3 className="text-h3 text-fg">{t('home.trust.items.certificate.title')}</h3>
            <p className="mt-2 text-body text-fg-secondary">
              {t('home.trust.items.certificate.body', { brand: BRAND.name })}
            </p>
            <p className="mt-4 text-body-sm">
              <Link to="/sertifikatli-imtahanlar" className={INLINE_LINK}>
                {t('home.trust.items.certificate.cta')}
              </Link>
            </p>
          </li>
          <li className="rounded-2xl border border-line bg-surface p-6 shadow-card">
            <SupportIcon className="mb-4 h-7 w-7 text-brand-text" />
            <h3 className="text-h3 text-fg">{t('home.trust.items.support.title')}</h3>
            <p className="mt-2 text-body text-fg-secondary">{t('home.trust.items.support.body')}</p>
            <p className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-body-sm">
              {MENTORIX_CONTACT.whatsappUrl ? (
                <a href={MENTORIX_CONTACT.whatsappUrl} target="_blank" rel="noreferrer noopener" className={INLINE_LINK}>
                  {t('home.trust.items.support.whatsapp')}
                </a>
              ) : null}
              {MENTORIX_CONTACT.email ? (
                <a href={`mailto:${MENTORIX_CONTACT.email}`} className={INLINE_LINK}>
                  {t('home.trust.items.support.email')}
                </a>
              ) : null}
            </p>
          </li>
        </ul>
        <ConfirmedSocialProof />
        {SHOW_PLACEHOLDERS ? <PlaceholderSlots /> : null}
      </div>
    </section>
  )
}
