import { useTranslation } from 'react-i18next'

/** Google / Zoom account connection is optional and in beta: pasting a meeting link always works. */
export default function OptionalBetaBadge({ className = '' }) {
  const { t } = useTranslation()
  return (
    <span
      data-testid="optional-beta-badge"
      className={`ml-2 inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200 ${className}`}
    >
      {t('live.optionalBeta')}
    </span>
  )
}
