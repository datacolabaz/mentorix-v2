import { useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../common/Card'
import { useToast } from '../common/Toast'
import EngagementPopover from './EngagementPopover'
import { CountChip, ProgressBar } from './EngagementParts'
import { fetchAssignmentDetail, reminderResultText, sendEngagementReminder } from './engagementApi'
import { formatDue, relativeTime } from '../../lib/engagementCopy'

const LIST_LIMIT = 5

function Group({ title, icon, students, meta }) {
  if (!students.length) return null
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-token-textMuted mb-1">
        <span aria-hidden="true">{icon}</span> {title} ({students.length})
      </p>
      <ul className="space-y-1">
        {students.slice(0, LIST_LIMIT).map((s) => (
          <li key={s.student_id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{s.full_name}</span>
            {meta ? <span className="shrink-0 text-[11px] text-token-textMuted">{meta(s)}</span> : null}
          </li>
        ))}
        {students.length > LIST_LIMIT ? (
          <li className="text-[11px] text-token-textMuted">+{students.length - LIST_LIMIT} daha</li>
        ) : null}
      </ul>
    </div>
  )
}

export default function AssignmentEngagementCard({ assignment }) {
  const toast = useToast()
  const [sending, setSending] = useState(false)
  const due = formatDue(assignment.due_date)
  const detailPath = `/instructor/engagement/assignment/${assignment.id}`

  const remind = async (refresh) => {
    setSending(true)
    try {
      toast(reminderResultText(await sendEngagementReminder('assignment', assignment.id)), 'success')
      await refresh()
    } catch (e) {
      toast(e?.message || 'Xatırlatma göndərilmədi', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm text-token-textMain truncate" title={assignment.title}>
            <span aria-hidden="true">📝</span> {assignment.title}
          </h3>
          <p className="text-[11px] text-token-textMuted truncate">{assignment.group_name || 'Qrup seçilməyib'}</p>
        </div>
        {due ? (
          <span
            className={`shrink-0 text-[11px] whitespace-nowrap font-semibold ${
              assignment.is_overdue ? 'text-red-600 dark:text-red-400' : 'text-token-textMuted'
            }`}
          >
            {assignment.is_overdue ? '! Vaxtı keçib · ' : 'Son tarix: '}
            {due}
          </span>
        ) : (
          <span className="shrink-0 text-[11px] text-token-textMuted">Son tarix yoxdur</span>
        )}
      </div>

      {assignment.assigned === 0 ? (
        <p className="text-xs text-token-textMuted rounded-xl border border-dashed border-[color:var(--border-subtle)] px-3 py-2">
          Bu tapşırıq hələ heç bir tələbəyə göndərilməyib.
        </p>
      ) : (
        <EngagementPopover
          label={`${assignment.title}: təqdim vəziyyəti`}
          load={() => fetchAssignmentDetail(assignment.id)}
          trigger={
            <div className="space-y-2 rounded-xl p-2 -m-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">
                  {assignment.submitted} / {assignment.assigned} təqdim edib
                </span>
                <span className="text-xs font-bold tabular-nums">{assignment.completion_pct}%</span>
              </div>
              <ProgressBar pct={assignment.completion_pct} label="Təqdim faizi" />
              <div className="flex flex-wrap gap-1.5">
                <CountChip tone="green" icon="✓">{assignment.graded} qiymətləndirilib</CountChip>
                <CountChip tone="yellow" icon="⏳">{assignment.waiting_grading} yoxlama gözləyir</CountChip>
                <CountChip tone="gray" icon="–">{assignment.not_submitted} təqdim etməyib</CountChip>
                {assignment.overdue ? <CountChip tone="red" icon="!">{assignment.overdue} vaxtı keçib</CountChip> : null}
                {assignment.not_opened ? <CountChip tone="gray" icon="○">{assignment.not_opened} açmayıb</CountChip> : null}
              </div>
            </div>
          }
        >
          {(data, { refresh }) => {
            const st = data.students
            const graded = st.filter((s) => s.status === 'graded')
            const waiting = st.filter((s) => s.status === 'submitted')
            const overdue = st.filter((s) => s.status === 'overdue')
            const pending = st.filter((s) => ['started', 'opened', 'not_opened'].includes(s.status))
            const remindable = overdue.length + pending.length
            return (
              <div className="space-y-3">
                <Group title="Qiymətləndirilib" icon="✓" students={graded} meta={(s) => (s.score != null ? `${Number(s.score)} bal` : '')} />
                <Group title="Yoxlama gözləyir" icon="⏳" students={waiting} meta={(s) => relativeTime(s.submitted_at)} />
                <Group
                  title="Təqdim etməyib"
                  icon="–"
                  students={pending}
                  meta={(s) => (s.status === 'started' ? 'başlayıb' : s.status === 'opened' ? 'açıb' : 'açmayıb')}
                />
                <Group title="Vaxtı keçib" icon="!" students={overdue} />
                {!st.length ? <p className="text-xs text-token-textMuted">Tələbə yoxdur.</p> : null}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-[color:var(--border-subtle)]">
                  <Link to={detailPath} className="mt-2 text-xs font-semibold text-primary hover:underline">
                    Təqdimləri yoxla →
                  </Link>
                  {remindable ? (
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => void remind(refresh)}
                      className="mt-2 ml-auto text-xs font-semibold rounded-lg border border-primary/40 px-2.5 py-1 text-primary hover:bg-primary/10 disabled:opacity-60"
                    >
                      {sending ? 'Göndərilir…' : `Xatırlatma göndər (${remindable})`}
                    </button>
                  ) : null}
                </div>
              </div>
            )
          }}
        </EngagementPopover>
      )}
    </Card>
  )
}
