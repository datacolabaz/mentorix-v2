import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Card from '../common/Card'
import EngagementPopover from './EngagementPopover'
import ReminderDialog from './ReminderDialog'
import { AvatarStack, CountChip, LastActivity, NameGroup, ProgressBar, RelativeTime, StatLines, StatusBadge } from './EngagementParts'
import { fetchExamDetail } from './engagementApi'
import { CTA_BUTTON, CTA_LINK, HOVER_BG } from '../../lib/engagementCopy'
import { averageInfo, cardLines, examSecondary, reminderEligible, statusMeta } from '../../lib/activityCards'
import { activityDetailPath, isAdminActivityMode } from '../../lib/adminActivityAccess'
import { formatDateTime } from '../../lib/formatDateTime'

function AverageLine({ card }) {
  const { t } = useTranslation()
  const avg = averageInfo(card)
  if (!avg) return null
  return (
    <p className="text-sm">
      <span className="font-bold">
        {avg.pct != null ? t('activity.exam.averagePct', { pct: avg.pct }) : t('activity.exam.averageScore', { score: avg.score, max: avg.max ?? '—' })}
      </span>{' '}
      <span className="text-[11px] text-token-textMuted">({t('activity.exam.averageBasis', { count: avg.count })})</span>
    </p>
  )
}

/**
 * İmtahan (qiymətləndirmə) kartı. variant="card" — Aktivlik səhifəsi; "embedded" — İmtahanlar siyahısındakı kartın içində.
 * Orta nəticə yalnız yoxlanmış, cavablı cəhdlər olduqda göstərilir. illustrative — yalnız demo dəyərlər göstəriləndə.
 */
export default function AssessmentEngagementCard({ exam, variant = 'card', illustrative = false, onChanged }) {
  const { t, i18n } = useTranslation()
  const [reminderOpen, setReminderOpen] = useState(false)
  const embedded = variant === 'embedded'
  const readOnly = isAdminActivityMode()
  const participantsPath = activityDetailPath('exam', exam.id)
  const resultsPath = activityDetailPath('exam', exam.id, { filter: 'completed' })
  const analyticsPath = `/instructor/analytics?exam=${encodeURIComponent(exam.id)}`
  const lines = cardLines('exam', exam)
  const secondary = examSecondary(exam)
  const label = t('activity.common.detailsLabel', { title: exam.title })
  const from = formatDateTime(exam.available_from, i18n.language)
  const until = formatDateTime(exam.available_until, i18n.language)
  const schedule =
    from && until
      ? t('activity.exam.schedule', { from, until })
      : from
        ? t('activity.exam.scheduleFrom', { from })
        : until
          ? t('activity.exam.scheduleUntil', { until })
          : t('activity.exam.noSchedule')
  const typeLine = [t('activity.types.exam'), exam.subject, exam.topic].filter(Boolean).join(' · ')
  const notStarted = Number(exam.not_started) || 0

  const summary = (
    <div className={`space-y-2 rounded-xl p-2 -m-2 ${HOVER_BG}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-token-textMuted">{t('activity.common.assignedOf', { count: exam.assigned })}</p>
        <span className="text-xs font-bold tabular-nums">{exam.completion_pct}%</span>
      </div>
      <ProgressBar pct={exam.completion_pct} label={t('activity.lines.exam.completed')} />
      <StatLines type="exam" lines={lines} />
      <p className="text-[11px] text-token-textMuted">{t('activity.exam.secondary', secondary)}</p>
      {secondary.auto_submitted ? (
        <CountChip tone="yellow" icon="⌛">
          {t('activity.exam.autoSubmitted', { count: secondary.auto_submitted })}
        </CountChip>
      ) : null}
      <AverageLine card={exam} />
      <div className="flex flex-wrap items-center justify-between gap-2 min-h-6">
        <AvatarStack people={exam.recent_completers} more={exam.more_completers} label={t('activity.exam.popover.recentCompleters')} />
        <LastActivity iso={exam.last_activity_at} />
      </div>
    </div>
  )

  const content = (
    <>
      {!embedded ? (
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="min-w-0 font-semibold text-sm text-token-textMain break-words [overflow-wrap:anywhere]">
              <span aria-hidden="true">🧪</span> {exam.title}
            </h3>
            {illustrative ? (
              <span className="shrink-0 rounded-md border border-[color:var(--border-subtle)] px-1.5 py-0.5 text-[10px] font-semibold text-token-textMuted">
                {t('activity.common.illustrative')}
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-token-textMuted break-words">
            {typeLine} · {exam.group_names?.length ? exam.group_names.join(', ') : t('activity.common.noGroup')}
          </p>
          <p className="text-[11px] text-token-textMuted break-words">
            {schedule}
            {exam.duration_minutes ? ` · ${t('activity.exam.duration', { count: exam.duration_minutes })}` : ''}
          </p>
        </div>
      ) : illustrative ? (
        <span className="self-start rounded-md border border-[color:var(--border-subtle)] px-1.5 py-0.5 text-[10px] font-semibold text-token-textMuted">
          {t('activity.common.illustrative')}
        </span>
      ) : null}

      {exam.assigned === 0 ? (
        <p className="text-xs text-token-textMuted rounded-xl border border-dashed border-[color:var(--border-subtle)] px-3 py-2">
          {t('activity.notAssigned.exam')}
        </p>
      ) : (
        <EngagementPopover label={label} load={() => fetchExamDetail(exam.id)} trigger={summary}>
          {(data, { close }) => {
            const st = data.students
            const card = data.exam || exam
            const remindable = st.filter((s) => reminderEligible('exam', s)).length
            return (
              <div className="space-y-3">
                <NameGroup
                  title={t('activity.exam.popover.completed')}
                  icon="✓"
                  tone="green"
                  students={st.filter((s) => s.completed)}
                  renderMeta={(s) => (s.score != null ? t('activity.report.score', { score: s.score }) : <StatusBadge meta={statusMeta('exam', s)} />)}
                  emptyText={t('activity.common.nobody')}
                />
                <NameGroup
                  title={t('activity.exam.popover.in_progress')}
                  icon="▶"
                  tone="blue"
                  students={st.filter((s) => s.in_progress)}
                  renderMeta={(s) => <RelativeTime iso={s.last_activity_at} />}
                />
                <NameGroup
                  title={t('activity.exam.popover.inactive')}
                  icon="⏸"
                  tone="yellow"
                  students={st.filter((s) => s.inactive)}
                  renderMeta={(s) => <RelativeTime iso={s.last_activity_at} />}
                />
                <NameGroup title={t('activity.exam.popover.not_started')} icon="○" students={st.filter((s) => !s.started && !s.expired)} />
                <NameGroup
                  title={t('activity.exam.popover.expired')}
                  icon="⌛"
                  tone="red"
                  students={st.filter((s) => s.expired)}
                  renderMeta={(s) => <StatusBadge meta={statusMeta('exam', s)} />}
                />
                {card.recent_completers?.length ? (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-token-textMuted mb-1">
                      {t('activity.exam.popover.recentCompleters')}
                    </p>
                    <AvatarStack people={card.recent_completers} more={card.more_completers} label={t('activity.exam.popover.recentCompleters')} />
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--border-subtle)] pt-2">
                  <Link to={resultsPath} className={CTA_LINK}>
                    {t('activity.exam.popover.viewResults')} →
                  </Link>
                  <Link to={participantsPath} className={CTA_LINK}>
                    {t('activity.exam.popover.showParticipants')} →
                  </Link>
                  {remindable && !readOnly ? (
                    <button
                      type="button"
                      className={`${CTA_BUTTON} ml-auto`}
                      onClick={() => {
                        close()
                        setReminderOpen(true)
                      }}
                    >
                      {t('activity.assignment.cta.remind')} ({remindable})
                    </button>
                  ) : null}
                </div>
              </div>
            )
          }}
        </EngagementPopover>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
        <Link to={resultsPath} className={CTA_LINK}>
          {t('activity.exam.cta.results')}
        </Link>
        {!readOnly ? (
          <Link to={analyticsPath} className={CTA_LINK}>
            {t('activity.exam.cta.analytics')}
          </Link>
        ) : null}
        <Link to={participantsPath} className={CTA_LINK}>
          {t('activity.exam.cta.participants')}
        </Link>
        {!readOnly && notStarted > 0 ? (
          <button type="button" className={`${CTA_BUTTON} ml-auto`} onClick={() => setReminderOpen(true)}>
            {t('activity.assignment.cta.remind')}
          </button>
        ) : null}
      </div>

      {!readOnly ? (
        <ReminderDialog
          open={reminderOpen}
          type="exam"
          entityId={exam.id}
          entityTitle={exam.title}
          onClose={() => setReminderOpen(false)}
          onSent={() => onChanged?.()}
        />
      ) : null}
    </>
  )

  if (embedded) return <div className="flex flex-col gap-3 min-w-0">{content}</div>
  return <Card className="p-4 flex flex-col gap-3">{content}</Card>
}
