import { useTranslation } from 'react-i18next'

/** Google / Zoom account connection is optional and in beta: pasting a meeting link always works. */
export default function OptionalBetaBadge({ className = '' }) {
  const { t } = useTranslation()
  return (
    <span
      data-testid="optional-beta-badge"
      className={`ml-2 inline-flex items-center rounded-full border border-warning/40 bg-warning-subtle px-2 py-0.5 align-middle text-caption font-semibold uppercase tracking-wide text-warning ${className}`}
    >
      {t('live.optionalBeta')}
    </span>
  )
}
