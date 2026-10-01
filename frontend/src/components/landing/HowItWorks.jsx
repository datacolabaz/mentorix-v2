import { useTranslation } from 'react-i18next'
import SectionHeading from './SectionHeading'
import { AiQuestionPreview, PreviewFrame, ResultsPreview, SetupFormPreview, SharePreview } from './ProductPreviews'
import { ChartIcon, CheckCircleIcon, GraduationIcon, ShareIcon, SlidersIcon, SparklesIcon } from './icons'

function CompactQuestionPreview() {
  return <AiQuestionPreview compact />
}

const STEP_ICONS = [SlidersIcon, SparklesIcon, ShareIcon, ChartIcon]
const STEP_PREVIEWS = [SetupFormPreview, CompactQuestionPreview, SharePreview, ResultsPreview]

export default function HowItWorks() {
  const { t } = useTranslation()
  const items = t('home.steps.items', { returnObjects: true })
  const steps = Array.isArray(items) ? items : []

  return (
    <section id="mx-steps" aria-labelledby="mx-steps-title" className="scroll-mt-20 border-y border-line bg-canvas-subtle">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <SectionHeading
          id="mx-steps-title"
          kicker={t('home.steps.kicker')}
          title={t('home.steps.title')}
          lead={t('home.steps.lead')}
        />

        <ol className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {steps.map((step, i) => {
            const StepIcon = STEP_ICONS[i] || SparklesIcon
            const Preview = STEP_PREVIEWS[i]
            return (
              <li key={step.title} className="flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-brand-text">
                    <StepIcon className="h-5 w-5" />
                  </span>
                  <span className="text-caption font-semibold uppercase tracking-wider text-fg-muted">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="text-h3 text-fg">{step.title}</h3>
                <p className="mt-2 text-body text-fg-secondary">{step.body}</p>
                {Preview ? (
                  <PreviewFrame className="mt-5" label={step.title} showCaption={false}>
                    <Preview />
                  </PreviewFrame>
                ) : null}
              </li>
            )
          })}
        </ol>
        <p className="mt-4 text-center text-caption text-fg-muted">{t('home.sampleLabel')}</p>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex gap-4 rounded-2xl border border-brand-text/30 bg-brand-subtle p-5 sm:p-6">
            <CheckCircleIcon className="mt-0.5 h-6 w-6 shrink-0 text-brand-text" />
            <div>
              <h3 className="text-h3 text-fg">{t('home.steps.principle.title')}</h3>
              <p className="mt-1.5 text-body text-fg-secondary">{t('home.steps.principle.body')}</p>
            </div>
          </div>
          <div className="flex gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <GraduationIcon className="mt-0.5 h-6 w-6 shrink-0 text-fg-secondary" />
            <div>
              <h3 className="text-h3 text-fg">{t('home.steps.student.title')}</h3>
              <p className="mt-1.5 text-body text-fg-secondary">{t('home.steps.student.body')}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
