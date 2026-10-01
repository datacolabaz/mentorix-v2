import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import { BRAND } from '../../lib/brand'
import {
  CheckCircleIcon,
  CopyIcon,
  DownloadIcon,
  PencilIcon,
  RefreshIcon,
  SparklesIcon,
} from './icons'

/**
 * Faithful, static recreations of real product screens (generation card, setup form, share, results).
 * They are illustrations: nothing inside is focusable or clickable, and every frame is captioned
 * with `home.sampleLabel` so sample data is never mistaken for real usage figures.
 */

function Chip({ children, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: 'border-line bg-surface text-fg-secondary',
    brand: 'border-transparent bg-brand text-brand-on',
    subtle: 'border-transparent bg-brand-subtle text-brand-text',
    info: 'border-transparent bg-info-subtle text-info',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-caption font-semibold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

export function PreviewFrame({ label, title, children, className = '', showCaption = true }) {
  const { t } = useTranslation()
  return (
    <figure className={`m-0 min-w-0 ${className}`} aria-label={label}>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface-elevated shadow-elevated">
        <div className="flex items-center gap-2 border-b border-line bg-canvas-subtle px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong/60" />
          </span>
          {title ? <span className="truncate text-caption font-semibold text-fg-secondary">{title}</span> : null}
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
      {showCaption ? (
        <figcaption className="mt-2 text-center text-caption text-fg-muted">{t('home.sampleLabel')}</figcaption>
      ) : null}
    </figure>
  )
}

export function AiQuestionPreview({ compact = false }) {
  const { t } = useTranslation()
  const options = t('home.preview.options', { returnObjects: true })
  const list = Array.isArray(options) ? options : []
  const letters = ['A', 'B', 'C', 'D']

  return (
    <div className="space-y-4 text-left">
      {!compact ? (
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="subtle">
            <SparklesIcon className="h-3.5 w-3.5" />
            {t('home.preview.topic')}
          </Chip>
          <Chip>{t('home.preview.language')}</Chip>
        </div>
      ) : null}
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-center justify-between gap-2 text-caption font-semibold text-fg-muted">
          <span>{t('home.preview.questionCounter')}</span>
          <Chip tone="info">{t('home.preview.difficulty')}</Chip>
        </div>
        <p className="text-body font-semibold text-fg">{t('home.preview.question')}</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {list.map((opt, i) => {
            const correct = i === 0
            return (
              <li
                key={opt}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-body-sm ${
                  correct ? 'border-brand-text/40 bg-brand-subtle text-fg' : 'border-line text-fg-secondary'
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-caption font-bold ${
                    correct ? 'bg-brand text-brand-on' : 'bg-canvas-subtle text-fg-secondary'
                  }`}
                  aria-hidden
                >
                  {letters[i]}
                </span>
                <span className="font-semibold">{opt}</span>
                {correct ? (
                  <span className="ml-auto inline-flex items-center gap-1 text-caption font-semibold text-brand-text">
                    <CheckCircleIcon className="h-4 w-4" />
                    <span className={compact ? 'sr-only' : ''}>{t('home.preview.correct')}</span>
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip>
          <PencilIcon className="h-3.5 w-3.5" />
          {t('home.preview.edit')}
        </Chip>
        <Chip>
          <RefreshIcon className="h-3.5 w-3.5" />
          {t('home.preview.regenerate')}
        </Chip>
        <Chip tone="brand" className="ml-auto">
          <CheckCircleIcon className="h-3.5 w-3.5" />
          {t('home.preview.approve')}
        </Chip>
      </div>
      {!compact ? <p className="text-caption text-fg-muted">{t('home.preview.approved')}</p> : null}
    </div>
  )
}

export function SetupFormPreview() {
  const { t } = useTranslation()
  const fields = [
    ['subject', 'subjectValue'],
    ['topic', 'topicValue'],
    ['level', 'levelValue'],
    ['count', 'countValue'],
  ]
  return (
    <div className="space-y-3 text-left">
      <dl className="grid grid-cols-2 gap-2.5">
        {fields.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-surface px-3 py-2">
            <dt className="text-caption text-fg-muted">{t(`home.steps.form.${label}`)}</dt>
            <dd className="m-0 text-body-sm font-semibold text-fg">{t(`home.steps.form.${value}`)}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center gap-2" aria-hidden>
        {['AZ', 'RU', 'EN'].map((code, i) => (
          <span
            key={code}
            className={`rounded-md border px-2 py-0.5 text-caption font-semibold ${
              i === 0 ? 'border-transparent bg-brand-subtle text-brand-text' : 'border-line text-fg-secondary'
            }`}
          >
            {code}
          </span>
        ))}
      </div>
      <div className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-body-sm font-semibold text-brand-on">
        <SparklesIcon className="h-4 w-4" />
        {t('home.steps.form.generate')}
      </div>
    </div>
  )
}

export function SharePreview() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-4 text-left">
      <div className="shrink-0 rounded-lg border border-line bg-white p-2">
        <QRCodeSVG
          value={`https://${BRAND.domain}/`}
          size={88}
          level="M"
          bgColor="#FFFFFF"
          fgColor="#0F172A"
          role="img"
          aria-label={t('home.steps.share.qrAlt')}
        />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-caption text-fg-muted">{t('home.steps.share.linkLabel')}</p>
        <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5">
          <span className="min-w-0 flex-1 truncate font-mono text-caption text-fg">{`${BRAND.domain}/exam/…`}</span>
          <span className="inline-flex items-center gap-1 text-caption font-semibold text-brand-text">
            <CopyIcon className="h-3.5 w-3.5" />
            {t('home.steps.share.copy')}
          </span>
        </div>
      </div>
    </div>
  )
}

export function ResultsPreview() {
  const { t } = useTranslation()
  const rows = t('home.steps.results.rows', { returnObjects: true })
  const list = Array.isArray(rows) ? rows : []
  return (
    <div className="space-y-3 text-left">
      <table className="w-full border-collapse text-body-sm">
        <thead>
          <tr className="text-caption text-fg-muted">
            <th scope="col" className="pb-1.5 text-left font-semibold">
              {t('home.steps.results.student')}
            </th>
            <th scope="col" className="pb-1.5 text-right font-semibold">
              {t('home.steps.results.score')}
            </th>
          </tr>
        </thead>
        <tbody>
          {list.map(([name, score]) => (
            <tr key={name} className="border-t border-line">
              <td className="py-1.5 text-fg">{name}</td>
              <td className="py-1.5 text-right font-semibold tabular-nums text-fg">{score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2">
        <Chip>
          <DownloadIcon className="h-3.5 w-3.5" />
          {t('home.steps.results.exportExcel')}
        </Chip>
        <Chip>
          <DownloadIcon className="h-3.5 w-3.5" />
          {t('home.steps.results.exportPdf')}
        </Chip>
      </div>
    </div>
  )
}
