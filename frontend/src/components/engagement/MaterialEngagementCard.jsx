import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Card from '../common/Card'
import { useToast } from '../common/Toast'
import EngagementPopover from './EngagementPopover'
import ReminderDialog from './ReminderDialog'
import {
  AvatarStack,
  DateTimeText,
  LastActivity,
  NameGroup,
  ProgressBar,
  RelativeTime,
  StatLines,
  StatusBadge,
} from './EngagementParts'
import { fetchMaterialDetail } from './engagementApi'
import { CTA_BUTTON, CTA_LINK, HOVER_BG, MATERIAL_KIND, SUBTLE_BG, formatDue } from '../../lib/engagementCopy'
import { cardLines, statusMeta } from '../../lib/activityCards'
import { activityDetailPath, isAdminActivityMode } from '../../lib/adminActivityAccess'
import { materialShareUrl } from '../../lib/materialShareUrl'

function Stat({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-token-textMuted break-words">{label}</dt>
      <dd className="text-sm font-bold tabular-nums">{children}</dd>
    </div>
  )
}

/**
 * Material kartı. variant="card" — Aktivlik səhifəsi (öz Card-ı ilə); "embedded" — Kitabxana kartının içində zolaq.
 * «Materialı əlavə edən / Yüklənmə tarixi» (müəllim) ilə «Faylı yükləyən tələbələr» (tələbə yükləmələri) ayrı saxlanılır.
 */
export default function MaterialEngagementCard({ material, variant = 'card', onShare, onChanged }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [reminderOpen, setReminderOpen] = useState(false)
  const embedded = variant === 'embedded'
  const kind = MATERIAL_KIND[material.kind] || MATERIAL_KIND.file
  const kindLabel = t(`activity.kinds.${material.kind || 'file'}`, kind.label)
  const due = formatDue(material.due_at)
  const detailPath = activityDetailPath('material', material.id)
  const readOnly = isAdminActivityMode()
  const lines = cardLines('material', material)
  const label = t('activity.common.detailsLabel', { title: material.title })

  const share = async () => {
    if (onShare) return onShare(material)
    const url = materialShareUrl(material.id)
    try {
      await navigator.clipboard.writeText(url)
      toast(t('materials.toasts.linkCopied'), 'success')
    } catch {
      toast(url, 'info')
    }
  }

  const summary = (
    <div className={`space-y-2 rounded-xl p-2 -m-2 ${HOVER_BG}`}>
      <p className="text-xs font-semibold text-token-textMuted">{t('activity.common.assignedOf', { count: material.assigned })}</p>
      <StatLines type="material" lines={lines} />
      <ProgressBar pct={material.assigned ? Math.round((material.viewed / material.assigned) * 100) : 0} label={t('activity.lines.material.viewed')} />
      <dl className="grid grid-cols-3 gap-2">
        <Stat label={t('activity.material.totalViews')}>{material.total_views ?? 0}</Stat>
        <Stat label={t('activity.material.uniqueDownloaders')}>{material.unique_downloaders ?? 0}</Stat>
        <Stat label={t('activity.material.totalDownloads')}>{material.total_downloads ?? 0}</Stat>
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-2 min-h-6">
        <AvatarStack people={material.recent_viewers} more={material.more_viewers} label={t('activity.material.recentViewers')} />
        <LastActivity iso={material.last_activity_at} />
      </div>
    </div>
  )

  const content = (
    <>
      {!embedded ? (
        <div className="flex items-start gap-3">
          <span className={`h-10 w-10 shrink-0 rounded-xl ${SUBTLE_BG} flex items-center justify-center text-xl`} aria-hidden="true">
            {kind.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm text-token-textMain break-words [overflow-wrap:anywhere]">{material.title}</h3>
            <p className="text-[11px] text-token-textMuted break-words">
              {kindLabel} · {material.group_names?.length ? material.group_names.join(', ') : t('activity.common.noGroup')}
            </p>
          </div>
          {due ? <span className="shrink-0 text-[11px] text-token-textMuted">{t('activity.material.due', { date: due })}</span> : null}
        </div>
      ) : null}

      {!embedded && (material.uploaded_by || material.created_at) ? (
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-token-textMuted">
          {material.uploaded_by?.full_name ? (
            <div className="flex gap-1">
              <dt>{t('activity.material.uploader')}:</dt>
              <dd className="font-semibold text-token-textMain">{material.uploaded_by.full_name}</dd>
            </div>
          ) : null}
          {material.created_at ? (
            <div className="flex gap-1">
              <dt>{t('activity.material.uploadDate')}:</dt>
              <dd>
                <DateTimeText iso={material.created_at} />
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {material.assigned === 0 ? (
        <p className="text-xs text-token-textMuted rounded-xl border border-dashed border-[color:var(--border-subtle)] px-3 py-2">
          {t('activity.notAssigned.material')}
        </p>
      ) : (
        <EngagementPopover label={label} load={() => fetchMaterialDetail(material.id)} trigger={summary}>
          {(data, { close }) => {
            const viewed = data.students.filter((s) => s.viewed)
            const downloaded = data.students.filter((s) => s.downloaded)
            const notViewed = data.students.filter((s) => !s.viewed)
            const card = data.material || material
            return (
              <div className="space-y-3">
                <NameGroup
                  title={t('activity.material.popover.viewed')}
                  icon="✓"
                  tone="green"
                  students={viewed}
                  renderMeta={(s) => <RelativeTime iso={s.last_viewed_at || s.last_activity_at} />}
                  emptyText={t('activity.common.nobody')}
                />
                <NameGroup
                  title={t('activity.material.popover.downloaded')}
                  icon="↓"
                  tone="blue"
                  students={downloaded}
                  renderMeta={(s) => `${s.download_count}×`}
                  emptyText={t('activity.common.nobody')}
                />
                <NameGroup
                  title={t('activity.material.popover.notViewed')}
                  icon="○"
                  students={notViewed}
                  renderMeta={(s) => <StatusBadge meta={statusMeta('material', s)} />}
                  emptyText={t('activity.common.nobody')}
                />
                <dl className="grid grid-cols-1 gap-1 text-xs border-t border-[color:var(--border-subtle)] pt-2">
                  <div className="flex justify-between gap-2">
                    <dt className="text-token-textMuted">{t('activity.material.popover.lastView')}</dt>
                    <dd>
                      <DateTimeText iso={card.last_viewed_at} />
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-token-textMuted">{t('activity.material.popover.lastDownload')}</dt>
                    <dd>
                      <DateTimeText iso={card.last_downloaded_at} />
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-token-textMuted">{t('activity.material.popover.totalDownloads')}</dt>
                    <dd className="font-semibold tabular-nums">{card.total_downloads ?? 0}</dd>
                  </div>
                </dl>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Link to={detailPath} className={CTA_LINK}>
                    {t('activity.common.showAll')} →
                  </Link>
                  {notViewed.length && !readOnly ? (
                    <button
                      type="button"
                      className={`${CTA_BUTTON} ml-auto`}
                      onClick={() => {
                        close()
                        setReminderOpen(true)
                      }}
                    >
                      {t('activity.material.cta.remindNotViewed')} ({notViewed.length})
                    </button>
                  ) : null}
                </div>
              </div>
            )
          }}
        </EngagementPopover>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
        <Link to={detailPath} className={CTA_LINK}>
          {t('activity.material.cta.activity')}
        </Link>
        {!readOnly ? (
          <button type="button" className={CTA_LINK} onClick={() => void share()}>
            {t('activity.material.cta.share')}
          </button>
        ) : null}
        {!readOnly && material.not_viewed > 0 ? (
          <button type="button" className={`${CTA_BUTTON} ml-auto`} onClick={() => setReminderOpen(true)}>
            {t('activity.material.cta.remindNotViewed')}
          </button>
        ) : null}
      </div>

      {!readOnly ? (
        <ReminderDialog
          open={reminderOpen}
          type="material"
          entityId={material.id}
          entityTitle={material.title}
          onClose={() => setReminderOpen(false)}
          onSent={() => onChanged?.()}
        />
      ) : null}
    </>
  )

  if (embedded) return <div className="flex flex-col gap-3 min-w-0">{content}</div>
  return <Card className="p-4 flex flex-col gap-3">{content}</Card>
}
