import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Card from '../common/Card'
import EngagementPopover from './EngagementPopover'
import ReminderDialog from './ReminderDialog'
import { LastActivity, NameGroup, ProgressBar, RelativeTime, StatLines } from './EngagementParts'
import { fetchAssignmentDetail } from './engagementApi'
import { CTA_BUTTON, CTA_LINK, HOVER_BG, formatDue } from '../../lib/engagementCopy'
import { cardLines } from '../../lib/activityCards'
import { activityDetailPath, isAdminActivityMode } from '../../lib/adminActivityAccess'

/**
 * Tapşırıq kartı. variant="card" — Aktivlik səhifəsi; "embedded" — Tapşırıqlar siyahısındakı kartın içində zolaq.
 * reviewHref — «İşləri yoxla» (yoxlama ekranı); verilməyibsə yoxlama gözləyənlər filtri ilə hesabat açılır.
 */
export default function AssignmentEngagementCard({ assignment, variant = 'card', reviewHref = null, onChanged }) {
  const { t } = useTranslation()
  const [reminderOpen, setReminderOpen] = useState(false)
  const embedded = variant === 'embedded'
  const due = formatDue(assignment.due_date)
  const detailPath = activityDetailPath('assignment', assignment.id)
  const reviewPath = reviewHref || activityDetailPath('assignment', assignment.id, { filter: 'waiting_grading' })
  const readOnly = isAdminActivityMode()
  const lines = cardLines('assignment', assignment)
  const label = t('activity.common.detailsLabel', { title: assignment.title })

  const summary = (
    <div className={`space-y-2 rounded-xl p-2 -m-2 ${HOVER_BG}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-token-textMuted">{t('activity.common.assignedOf', { count: assignment.assigned })}</p>
        <span className="text-xs font-bold tabular-nums">{assignment.completion_pct}%</span>
      </div>
      <ProgressBar pct={assignment.completion_pct} label={t('activity.lines.assignment.submitted')} />
      <StatLines type="assignment" lines={lines} />
      <LastActivity iso={assignment.last_activity_at} />
    </div>
  )

  const content = (
    <>
      {!embedded ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-token-textMain break-words [overflow-wrap:anywhere]">
              <span aria-hidden="true">📝</span> {assignment.title}
            </h3>
            <p className="text-[11px] text-token-textMuted break-words">{assignment.group_name || t('activity.common.noGroup')}</p>
          </div>
          <span
            className={`shrink-0 text-[11px] font-semibold ${
              assignment.is_overdue ? 'text-red-700 [.theme-dark_&]:text-red-300' : 'text-token-textMuted'
            }`}
          >
            {due ? (
              assignment.is_overdue ? (
                <>
                  <span aria-hidden="true">! </span>
                  {t('activity.assignment.overdueDue', { date: due })}
                </>
              ) : (
                t('activity.assignment.due', { date: due })
              )
            ) : (
              t('activity.assignment.noDue')
            )}
          </span>
        </div>
      ) : null}

      {assignment.assigned === 0 ? (
        <p className="text-xs text-token-textMuted rounded-xl border border-dashed border-[color:var(--border-subtle)] px-3 py-2">
          {t('activity.notAssigned.assignment')}
        </p>
      ) : (
        <EngagementPopover label={label} load={() => fetchAssignmentDetail(assignment.id)} trigger={summary}>
          {(data, { close }) => {
            const st = data.students
            const submitted = st.filter((s) => s.submitted)
            const startedOnly = st.filter((s) => s.status === 'started')
            const notOpened = st.filter((s) => s.status === 'not_opened')
            const late = st.filter((s) => s.status === 'overdue' || s.is_late)
            const remindable = st.filter((s) => !s.submitted).length
            const card = data.assignment || assignment
            return (
              <div className="space-y-3">
                <NameGroup
                  title={t('activity.assignment.popover.submitted')}
                  icon="✓"
                  tone="green"
                  students={submitted}
                  renderMeta={(s) => (s.score != null ? t('activity.report.score', { score: Number(s.score) }) : <RelativeTime iso={s.submitted_at} />)}
                  emptyText={t('activity.common.nobody')}
                />
                <NameGroup
                  title={t('activity.assignment.popover.startedNotSubmitted')}
                  icon="✎"
                  tone="blue"
                  students={startedOnly}
                  renderMeta={(s) => <RelativeTime iso={s.last_activity_at} />}
                />
                <NameGroup title={t('activity.assignment.popover.notOpened')} icon="○" students={notOpened} />
                <NameGroup title={t('activity.assignment.popover.late')} icon="!" tone="red" students={late} />
                <p className="border-t border-[color:var(--border-subtle)] pt-2">
                  <LastActivity iso={card.last_activity_at} />
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={detailPath} className={CTA_LINK}>
                    {t('activity.common.showAll')} →
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
        <Link to={detailPath} className={CTA_LINK}>
          {t('activity.assignment.cta.submissions')}
        </Link>
        {!readOnly ? (
          <Link to={reviewPath} className={CTA_LINK}>
            {t('activity.assignment.cta.review')}
            {assignment.pending_review ? ` (${assignment.pending_review})` : ''}
          </Link>
        ) : null}
        {!readOnly && assignment.not_submitted > 0 ? (
          <button type="button" className={`${CTA_BUTTON} ml-auto`} onClick={() => setReminderOpen(true)}>
            {t('activity.assignment.cta.remind')}
          </button>
        ) : null}
      </div>

      {!readOnly ? (
        <ReminderDialog
          open={reminderOpen}
          type="assignment"
          entityId={assignment.id}
          entityTitle={assignment.title}
          onClose={() => setReminderOpen(false)}
          onSent={() => onChanged?.()}
        />
      ) : null}
    </>
  )

  if (embedded) return <div className="flex flex-col gap-3 min-w-0">{content}</div>
  return <Card className="p-4 flex flex-col gap-3">{content}</Card>
}
