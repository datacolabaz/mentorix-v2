import { useTranslation } from 'react-i18next'
import { AiQuestionPreview, PreviewFrame } from './ProductPreviews'
import { ArrowRightIcon, CheckIcon } from './icons'

export const PRIMARY_BTN =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 min-h-12 text-button text-brand-on shadow-card transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'

export const SECONDARY_BTN =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-6 min-h-12 text-button text-fg transition-colors hover:bg-canvas-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'

export default function HomeHero({ onPrimary, onSecondary, onLogin, loggedIn = false }) {
  const { t } = useTranslation()
  const points = t('home.hero.points', { returnObjects: true })

  return (
    <section id="mx-hero" aria-labelledby="mx-hero-title" className="relative isolate overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-gradient-to-b from-brand-subtle/70 to-transparent"
        aria-hidden
      />
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-24 lg:pt-20">
        <div className="min-w-0">
          <p className="mb-4 inline-flex items-center rounded-full border border-line bg-surface px-3 py-1 text-caption font-semibold text-brand-text">
            {t('home.hero.eyebrow')}
          </p>
          <h1 id="mx-hero-title" className="text-display text-fg">
            {t('home.hero.title')}
          </h1>
          <p className="mt-5 max-w-measure text-body-lg text-fg-secondary">{t('home.hero.subtitle')}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button type="button" onClick={onPrimary} className={PRIMARY_BTN}>
              {t('home.hero.primaryCta')}
              <ArrowRightIcon className="h-4 w-4" />
            </button>
            <a href="#mx-steps" onClick={onSecondary} className={SECONDARY_BTN}>
              {t('home.hero.secondaryCta')}
            </a>
          </div>

          {Array.isArray(points) ? (
            <ul className="mt-7 grid gap-2.5 text-body-sm text-fg-secondary">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand-text">
                    <CheckIcon className="h-3.5 w-3.5" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          ) : null}

          {!loggedIn ? (
            <p className="mt-6 text-body-sm text-fg-muted">
              {t('home.hero.haveAccount')}{' '}
              <button
                type="button"
                onClick={onLogin}
                className="rounded-sm font-semibold text-brand-text underline underline-offset-4 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {t('home.hero.login')}
              </button>
            </p>
          ) : null}
        </div>

        <PreviewFrame
          label={t('home.preview.ariaLabel')}
          title={t('home.preview.appTitle')}
          className="mx-auto w-full max-w-xl lg:max-w-none"
        >
          <AiQuestionPreview />
        </PreviewFrame>
      </div>
    </section>
  )
}
