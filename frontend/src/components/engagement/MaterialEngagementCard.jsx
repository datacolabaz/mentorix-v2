import { useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../common/Card'
import { useToast } from '../common/Toast'
import EngagementPopover from './EngagementPopover'
import { AvatarStack, CountChip, ProgressBar, StatusBadge } from './EngagementParts'
import { fetchMaterialDetail, reminderResultText, sendEngagementReminder } from './engagementApi'
import { MATERIAL_KIND, MATERIAL_STATUS, formatDue, isRecent, materialStatusKey, relativeTime } from '../../lib/engagementCopy'
import { engagementBasePath, isAdminActivityMode } from '../../lib/adminActivityAccess'

const LIST_LIMIT = 6

function NameList({ title, students, renderMeta, emptyText }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-token-textMuted mb-1">
        {title} ({students.length})
      </p>
      {students.length ? (
        <ul className="space-y-1">
          {students.slice(0, LIST_LIMIT).map((s) => (
            <li key={s.student_id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{s.full_name}</span>
              {renderMeta ? <span className="shrink-0 text-[11px] text-token-textMuted">{renderMeta(s)}</span> : null}
            </li>
          ))}
          {students.length > LIST_LIMIT ? (
            <li className="text-[11px] text-token-textMuted">+{students.length - LIST_LIMIT} daha</li>
          ) : null}
        </ul>
      ) : (
        <p className="text-xs text-token-textMuted">{emptyText}</p>
      )}
    </div>
  )
}

export default function MaterialEngagementCard({ material }) {
  const toast = useToast()
  const [sending, setSending] = useState(false)
  const kind = MATERIAL_KIND[material.kind] || MATERIAL_KIND.file
  const due = formatDue(material.due_at)
  const recent = isRecent(material.last_activity_at)
  const detailPath = `${engagementBasePath()}/material/${material.id}`
  const readOnly = isAdminActivityMode()

  const remind = async (refresh) => {
    setSending(true)
    try {
      toast(reminderResultText(await sendEngagementReminder('material', material.id)), 'success')
      await refresh()
    } catch (e) {
      toast(e?.message || 'Xatırlatma göndərilmədi', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span
          className="h-10 w-10 shrink-0 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-xl"
          title={kind.label}
          aria-label={kind.label}
        >
          {kind.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm text-token-textMain truncate" title={material.title}>
            {material.title}
          </h3>
          <p className="text-[11px] text-token-textMuted truncate">
            {kind.label} · {material.group_names?.length ? material.group_names.join(', ') : 'Qrup seçilməyib'}
          </p>
        </div>
        {due ? <span className="shrink-0 text-[11px] text-token-textMuted whitespace-nowrap">Son tarix: {due}</span> : null}
      </div>

      {material.assigned === 0 ? (
        <p className="text-xs text-token-textMuted rounded-xl border border-dashed border-[color:var(--border-subtle)] px-3 py-2">
          Bu material hələ heç bir tələbəyə göndərilməyib.
        </p>
      ) : (
        <EngagementPopover
          label={`${material.title}: tələbə aktivliyi`}
          load={() => fetchMaterialDetail(material.id)}
          trigger={
            <div className="space-y-2 rounded-xl p-2 -m-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">
                  {material.viewed} / {material.assigned} baxıb
                </span>
                <span className="text-xs font-bold tabular-nums">{material.completion_pct}% tamamlanıb</span>
              </div>
              <ProgressBar pct={material.completion_pct} label="Tamamlanma faizi" />
              <div className="flex items-center justify-between gap-2 min-h-6">
                <AvatarStack people={material.recent_viewers} more={material.more_viewers} />
                <span className={`text-[11px] ${recent ? 'text-sky-600 dark:text-sky-300 font-semibold' : 'text-token-textMuted'}`}>
                  {recent ? '● ' : ''}Son aktivlik: {relativeTime(material.last_activity_at)}
                </span>
              </div>
              {material.overdue || material.not_opened ? (
                <div className="flex flex-wrap gap-1.5">
                  {material.overdue ? <CountChip tone="red" icon="!">{material.overdue} vaxtı keçib</CountChip> : null}
                  {material.not_opened ? <CountChip tone="gray" icon="○">{material.not_opened} açmayıb</CountChip> : null}
                </div>
              ) : null}
            </div>
          }
        >
          {(data, { refresh }) => {
            const viewed = data.students.filter((s) => s.viewed)
            const notViewed = data.students.filter((s) => !s.viewed)
            return (
              <div className="space-y-3">
                <NameList
                  title="Baxanlar"
                  students={viewed}
                  renderMeta={(s) => relativeTime(s.last_activity_at)}
                  emptyText="Hələ heç kim baxmayıb."
                />
                <NameList
                  title="Baxmayanlar"
                  students={notViewed}
                  renderMeta={(s) => <StatusBadge meta={MATERIAL_STATUS[materialStatusKey(s)]} />}
                  emptyText="Hamı baxıb."
                />
                <div className="flex flex-wrap gap-2 pt-1 border-t border-[color:var(--border-subtle)]">
                  <Link to={detailPath} className="mt-2 text-xs font-semibold text-primary hover:underline">
                    Bütün tələbələrə bax →
                  </Link>
                  {notViewed.length && !readOnly ? (
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => void remind(refresh)}
                      className="mt-2 ml-auto text-xs font-semibold rounded-lg border border-primary/40 px-2.5 py-1 text-primary hover:bg-primary/10 disabled:opacity-60"
                    >
                      {sending ? 'Göndərilir…' : `Xatırlatma göndər (${notViewed.length})`}
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
