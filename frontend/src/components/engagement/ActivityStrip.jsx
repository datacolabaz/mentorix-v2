import { useTranslation } from 'react-i18next'
import AssessmentEngagementCard from './AssessmentEngagementCard'
import AssignmentEngagementCard from './AssignmentEngagementCard'
import MaterialEngagementCard from './MaterialEngagementCard'
import { StripSkeleton } from './EngagementParts'

/**
 * Siyahı səhifəsindəki mövcud kartın içində aktivlik zolağı (İmtahanlar, Tapşırıqlar, Kitabxana).
 * Məlumat useActivitySummaries ilə paketlə gəlir; xəta olsa kart işləməyə davam edir, yalnız qısa qeyd görünür.
 */
export default function ActivityStrip({ type, item, loading, error, onChanged, className = '', ...cardProps }) {
  const { t } = useTranslation()
  const frame = `mt-3 border-t border-[color:var(--border-subtle)] pt-3 min-w-0 ${className}`
  if (!item) {
    if (loading) {
      return (
        <div className={frame} role="status" aria-label={t('activity.common.loading')}>
          <StripSkeleton />
        </div>
      )
    }
    if (error) return <p className={`${frame} text-[11px] text-token-textMuted`}>{t('activity.common.unavailable')}</p>
    return null
  }
  return (
    <div className={frame}>
      {type === 'exam' ? (
        <AssessmentEngagementCard exam={item} variant="embedded" onChanged={onChanged} {...cardProps} />
      ) : type === 'assignment' ? (
        <AssignmentEngagementCard assignment={item} variant="embedded" onChanged={onChanged} {...cardProps} />
      ) : (
        <MaterialEngagementCard material={item} variant="embedded" onChanged={onChanged} {...cardProps} />
      )}
    </div>
  )
}
