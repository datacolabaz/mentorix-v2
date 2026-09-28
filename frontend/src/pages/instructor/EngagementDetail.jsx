import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import api from '../../lib/api'
import { Avatar, ProgressBar, StatusBadge } from '../../components/engagement/EngagementParts'
import {
  fetchAssignmentDetail,
  fetchMaterialDetail,
  reminderResultText,
  sendEngagementReminder,
} from '../../components/engagement/engagementApi'
import {
  ASSIGNMENT_FILTERS,
  ASSIGNMENT_STATUS,
  MATERIAL_FILTERS,
  MATERIAL_KIND,
  MATERIAL_STATUS,
  formatDue,
  materialStatusKey,
  relativeTime,
} from '../../lib/engagementCopy'
import { localDatetimeInputToUtcIso, utcInstantToDatetimeLocalValue } from '../../lib/examDatetime'

function canRemind(type, s) {
  return type === 'material' ? !s.viewed : !s.submitted
}

export default function InstructorEngagementDetail() {
  const { type: rawType, id } = useParams()
  const type = rawType === 'assignment' ? 'assignment' : 'material'
  const toast = useToast()
  const [filter, setFilter] = useState('')
  const [state, setState] = useState({ loading: true, error: '', data: null })
  const [selected, setSelected] = useState(() => new Set())
  const [sending, setSending] = useState(false)
  const [dueInput, setDueInput] = useState('')
  const [savingDue, setSavingDue] = useState(false)

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    try {
      const data = type === 'material' ? await fetchMaterialDetail(id) : await fetchAssignmentDetail(id)
      setState({ loading: false, error: '', data })
      if (type === 'material') setDueInput(utcInstantToDatetimeLocalValue(data?.material?.due_at) || '')
    } catch (e) {
      setState({ loading: false, error: e?.message || 'Hesabat yüklənmədi', data: null })
    }
  }, [type, id])

  useEffect(() => {
    void load()
  }, [load])

  const entity = state.data?.[type]
  const filters = type === 'material' ? MATERIAL_FILTERS : ASSIGNMENT_FILTERS
  const students = useMemo(() => {
    const all = state.data?.students || []
    if (!filter) return all
    const tests = {
      viewed: (s) => s.viewed,
      not_viewed: (s) => !s.viewed,
      overdue: (s) => s.overdue,
      submitted: (s) => s.submitted,
      not_submitted: (s) => !s.submitted,
      waiting_grading: (s) => s.waiting_grading,
      graded: (s) => s.graded,
      not_opened: (s) => s.status === 'not_opened',
    }
    return all.filter(tests[filter] || (() => true))
  }, [state.data, filter])

  const remindable = students.filter((s) => canRemind(type, s))
  const allSelected = remindable.length > 0 && remindable.every((s) => selected.has(s.student_id))

  const toggle = (sid) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(sid)) next.delete(sid)
      else next.add(sid)
      return next
    })

  const remind = async (ids) => {
    setSending(true)
    try {
      toast(reminderResultText(await sendEngagementReminder(type, id, ids)), 'success')
      setSelected(new Set())
      await load()
    } catch (e) {
      toast(e?.message || 'Xatırlatma göndərilmədi', 'error')
    } finally {
      setSending(false)
    }
  }

  const saveDue = async () => {
    setSavingDue(true)
    try {
      await api.patch(`/engagement/materials/${encodeURIComponent(id)}/deadline`, {
        due_at: dueInput ? localDatetimeInputToUtcIso(dueInput) : null,
      })
      toast(dueInput ? 'Son tarix saxlanıldı' : 'Son tarix silindi', 'success')
      await load()
    } catch (e) {
      toast(e?.message || 'Son tarix saxlanılmadı', 'error')
    } finally {
      setSavingDue(false)
    }
  }

  if (state.loading && !state.data) {
    return (
      <div className="p-6 text-sm text-token-textMuted" role="status">
        Hesabat yüklənir…
      </div>
    )
  }
  if (state.error) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <Card className="p-6 text-center">
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              Yenidən cəhd et
            </Button>
            <Link to="/instructor/engagement">
              <Button size="sm" variant="ghost">Aktivliyə qayıt</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  const pct = entity?.completion_pct || 0
  const kind = type === 'material' ? MATERIAL_KIND[entity?.kind] || MATERIAL_KIND.file : null

  return (
    <div className="p-4 sm:p-6 w-full min-w-0 max-w-5xl mx-auto space-y-5">
      <Link
        to={`/instructor/engagement${type === 'assignment' ? '?tab=assignments' : ''}`}
        className="text-sm font-semibold text-primary hover:underline"
      >
        ← Aktivlik
      </Link>

      <Card className="p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-token-textMuted">
              {type === 'material' ? `${kind.icon} ${kind.label}` : '📝 Tapşırıq'} ·{' '}
              {type === 'material' ? entity?.group_names?.join(', ') || 'Qrup seçilməyib' : entity?.group_name || 'Qrup seçilməyib'}
            </p>
            <h1 className="font-display font-bold text-xl text-token-textMain break-words">{entity?.title}</h1>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold tabular-nums">{pct}%</p>
            <p className="text-xs text-token-textMuted">
              {type === 'material'
                ? `${entity?.viewed} / ${entity?.assigned} baxıb`
                : `${entity?.submitted} / ${entity?.assigned} təqdim edib`}
            </p>
          </div>
        </div>
        <ProgressBar pct={pct} label="Tamamlanma faizi" />
        {type === 'assignment' ? (
          <p className="text-xs text-token-textMuted">
            {entity?.due_date ? `Son tarix: ${formatDue(entity.due_date)}${entity.is_overdue ? ' (vaxtı keçib)' : ''}` : 'Son tarix yoxdur'} ·{' '}
            {entity?.graded} qiymətləndirilib · {entity?.waiting_grading} yoxlama gözləyir ·{' '}
            <Link to="/instructor/tasks" className="font-semibold text-primary hover:underline">
              Təqdimləri yoxla
            </Link>
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-token-textMuted">
              Son baxış tarixi (istəyə bağlı)
              <input
                type="datetime-local"
                value={dueInput}
                onChange={(e) => setDueInput(e.target.value)}
                className="block mt-1 rounded-lg border border-[color:var(--border-subtle)] bg-token-surfaceCard px-2 py-1.5 text-sm text-token-textMain"
              />
            </label>
            <Button size="sm" variant="secondary" loading={savingDue} onClick={() => void saveDue()}>
              Saxla
            </Button>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.id || 'all'}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => {
              setFilter(f.id)
              setSelected(new Set())
            }}
            className={`px-3 py-1 rounded-lg border text-xs font-semibold ${
              filter === f.id
                ? 'border-primary bg-primary/15 text-token-textMain'
                : 'border-[color:var(--border-subtle)] text-token-textMuted hover:text-token-textMain'
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={!selected.size || sending}
            onClick={() => void remind([...selected])}
          >
            Seçilənlərə xatırlatma ({selected.size})
          </Button>
          <Button size="sm" disabled={!remindable.length || sending} loading={sending} onClick={() => void remind(null)}>
            {type === 'material' ? 'Baxmayanlara xatırlat' : 'Təqdim etməyənlərə xatırlat'}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {!students.length ? (
          <p className="text-center py-10 text-sm text-token-textMuted">
            {state.data?.students?.length ? 'Bu filtrə uyğun tələbə yoxdur.' : 'Bu hələ heç bir tələbəyə göndərilməyib.'}
          </p>
        ) : (
          <ul className="divide-y divide-[color:var(--border-subtle)]">
            <li className="px-4 py-2 flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-token-textMuted">
              <input
                type="checkbox"
                aria-label="Hamısını seç"
                checked={allSelected}
                disabled={!remindable.length}
                onChange={() => setSelected(allSelected ? new Set() : new Set(remindable.map((s) => s.student_id)))}
                className="accent-blue-500"
              />
              <span className="flex-1">Tələbə</span>
              <span className="hidden sm:block w-40">Status</span>
              <span className="w-28 text-right">Son aktivlik</span>
            </li>
            {students.map((s) => {
              const meta = type === 'material' ? MATERIAL_STATUS[materialStatusKey(s)] : ASSIGNMENT_STATUS[s.status]
              return (
                <li key={s.student_id} className="px-4 py-2.5 flex items-center gap-3">
                  <input
                    type="checkbox"
                    aria-label={`${s.full_name} seç`}
                    checked={selected.has(s.student_id)}
                    disabled={!canRemind(type, s)}
                    onChange={() => toggle(s.student_id)}
                    className="accent-blue-500"
                  />
                  <Avatar id={s.student_id} name={s.full_name} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{s.full_name}</p>
                    <p className="text-[11px] text-token-textMuted truncate">
                      {type === 'material'
                        ? [s.group_name, s.progress_pct ? `${s.progress_pct}% izlənib` : null, s.open_count ? `${s.open_count} dəfə açıb` : null]
                            .filter(Boolean)
                            .join(' · ') || '—'
                        : s.score != null
                          ? `${Number(s.score)} bal`
                          : '—'}
                    </p>
                    <StatusBadge meta={meta} className="sm:hidden mt-1" />
                  </div>
                  <span className="hidden sm:block w-40">
                    <StatusBadge meta={meta} />
                  </span>
                  <span className="w-28 text-right text-xs text-token-textMuted">{relativeTime(s.last_activity_at)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
