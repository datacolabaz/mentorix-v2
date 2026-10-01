import { Fragment, useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import api from '../../lib/api'
import { Avatar, DateTimeText, ProgressBar, RelativeTime, StatLines, StatusBadge } from '../../components/engagement/EngagementParts'
import ReminderDialog from '../../components/engagement/ReminderDialog'
import { fetchEngagementDetail, fetchStudentTimeline } from '../../components/engagement/engagementApi'
import { CTA_LINK, MATERIAL_KIND, formatDue } from '../../lib/engagementCopy'
import {
  REPORT_FILTER_IDS,
  REPORT_PAGE_SIZE,
  STATUS_IDS,
  averageInfo,
  cardLines,
  readReportState,
  reminderEligible,
  reportStateToParams,
  reportStateToSearch,
  statusMeta,
  timelineEventKey,
} from '../../lib/activityCards'
import { formatDateTime } from '../../lib/formatDateTime'
import { localDatetimeInputToUtcIso, utcInstantToDatetimeLocalValue } from '../../lib/examDatetime'
import { activityDetailPath, engagementBasePath, isAdminActivityMode } from '../../lib/adminActivityAccess'

const TYPES = new Set(['material', 'assignment', 'exam'])
const INPUT = 'rounded-lg border border-[color:var(--border-subtle)] bg-token-surfaceCard px-2 py-1.5 text-sm text-token-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'

function ResultCell({ type, row }) {
  const { t } = useTranslation()
  if (type === 'exam') {
    if (row.score != null) return <span className="font-semibold tabular-nums">{t('activity.report.score', { score: row.score })}</span>
    return row.answered_count ? <span>{t('activity.report.answered', { count: row.answered_count })}</span> : <span>—</span>
  }
  if (type === 'assignment') {
    return row.score != null ? <span className="font-semibold tabular-nums">{t('activity.report.score', { score: Number(row.score) })}</span> : <span>—</span>
  }
  const parts = [
    row.view_count ? t('activity.report.views', { count: row.view_count }) : null,
    row.download_count ? t('activity.report.downloads', { count: row.download_count }) : null,
    row.progress_pct ? t('activity.report.progress', { pct: row.progress_pct }) : null,
  ].filter(Boolean)
  return <span>{parts.join(' · ') || '—'}</span>
}

function Timeline({ type, entityId, student, id }) {
  const { t, i18n } = useTranslation()
  const [state, setState] = useState({ loading: true, error: '', data: null })

  useEffect(() => {
    let alive = true
    fetchStudentTimeline(type, entityId, student.student_id)
      .then((data) => alive && setState({ loading: false, error: '', data }))
      .catch((e) => alive && setState({ loading: false, error: e?.message || t('activity.common.loadError'), data: null }))
    return () => {
      alive = false
    }
  }, [type, entityId, student.student_id, t])

  const details = (d = {}) =>
    [
      d.late ? t('activity.timeline.details.late') : null,
      d.progress_pct != null ? t('activity.timeline.details.progress', { pct: d.progress_pct }) : null,
      d.answered_count != null ? t('activity.timeline.details.answered', { count: d.answered_count }) : null,
      d.delivery === 'delivered' ? t('activity.timeline.details.delivered') : d.delivery === 'failed' ? t('activity.timeline.details.failed') : null,
    ].filter(Boolean)

  return (
    <div id={id} className="px-4 pb-4 pt-1">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-token-textMuted">{t('activity.report.timelineTitle')}</p>
      {state.loading ? (
        <p role="status" className="text-xs text-token-textMuted">
          {t('activity.common.loading')}
        </p>
      ) : state.error ? (
        <p className="text-xs text-red-700 [.theme-dark_&]:text-red-300">{state.error}</p>
      ) : !state.data?.events?.length ? (
        <p className="text-xs text-token-textMuted">{t('activity.report.timelineEmpty')}</p>
      ) : (
        <>
          <ol className="relative ml-2 space-y-2 border-l border-[color:var(--border-subtle)] pl-4">
            {state.data.events.map((ev, i) => (
              <li key={`${ev.at}-${i}`} className="text-sm">
                <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                <span className="font-semibold">{t(`activity.timeline.events.${timelineEventKey(ev.event_type)}`)}</span>
                {details(ev.details).length ? <span className="text-token-textMuted"> · {details(ev.details).join(' · ')}</span> : null}
                <span className="block text-[11px] text-token-textMuted">
                  <time dateTime={ev.at}>{formatDateTime(ev.at, i18n.language)}</time>
                </span>
              </li>
            ))}
          </ol>
          {state.data.truncated ? <p className="mt-2 text-[11px] text-token-textMuted">{t('activity.report.timelineTruncated')}</p> : null}
        </>
      )}
    </div>
  )
}

/**
 * Bir obyektin aktivlik hesabatı:
 * /instructor/exams/:id/participants, /instructor/assignments/:id/activity, /instructor/materials/:id/activity
 * (köhnə /instructor/engagement/:type/:id və admin oxuma rejimi də bura gəlir).
 * Filtr, səhifələmə və axtarış serverdə; vəziyyət URL-də saxlanılır (kartdakı rəqəm = həmin filtrin cəmi).
 */
export default function InstructorEngagementDetail({ type: typeProp, id: idProp } = {}) {
  const { t } = useTranslation()
  const params = useParams()
  const rawType = typeProp || params.type
  const id = idProp || params.id
  const type = TYPES.has(rawType) ? rawType : 'material'
  const readOnly = isAdminActivityMode()
  const basePath = engagementBasePath()
  const toast = useToast()
  const [search, setSearch] = useSearchParams()
  const report = useMemo(() => readReportState(type, search), [type, search])
  const [qInput, setQInput] = useState(report.q)
  const [state, setState] = useState({ loading: true, error: '', data: null })
  const [selected, setSelected] = useState(() => new Set())
  const [expanded, setExpanded] = useState(null)
  const [reminder, setReminder] = useState(null)
  const [dueInput, setDueInput] = useState('')
  const [savingDue, setSavingDue] = useState(false)
  const filtersId = useId()

  const update = useCallback(
    (patch) => {
      const next = { ...report, ...patch }
      if (!('page' in patch)) next.page = 1
      setSearch(reportStateToSearch(next), { replace: true })
      setSelected(new Set())
      setExpanded(null)
    },
    [report, setSearch],
  )

  useEffect(() => {
    setQInput(report.q)
  }, [report.q])

  useEffect(() => {
    if (qInput.trim() === report.q) return undefined
    const timer = setTimeout(() => update({ q: qInput.trim() }), 300)
    return () => clearTimeout(timer)
  }, [qInput, report.q, update])

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    try {
      const data = await fetchEngagementDetail(type, id, reportStateToParams(report, REPORT_PAGE_SIZE))
      setState({ loading: false, error: '', data })
      if (type === 'material') setDueInput(utcInstantToDatetimeLocalValue(data?.material?.due_at) || '')
    } catch (e) {
      setState({ loading: false, error: e?.message || t('activity.report.error'), data: null })
    }
  }, [type, id, report, t])

  useEffect(() => {
    void load()
  }, [load])

  const entity = state.data?.[type]
  const students = state.data?.students || []
  const pagination = state.data?.pagination || { page: 1, page_size: REPORT_PAGE_SIZE, total: students.length, total_pages: 1 }
  const groups = state.data?.available_groups || []
  const eligible = students.filter((s) => reminderEligible(type, s))
  const allSelected = eligible.length > 0 && eligible.every((s) => selected.has(s.student_id))
  const hasFilters = Boolean(report.filter || report.status || report.group || report.q || report.from || report.to)

  const toggle = (sid) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(sid)) next.delete(sid)
      else next.add(sid)
      return next
    })

  const saveDue = async () => {
    setSavingDue(true)
    try {
      await api.patch(`/engagement/materials/${encodeURIComponent(id)}/deadline`, {
        due_at: dueInput ? localDatetimeInputToUtcIso(dueInput) : null,
      })
      toast(dueInput ? t('activity.report.deadlineSaved') : t('activity.report.deadlineCleared'), 'success')
      await load()
    } catch (e) {
      toast(e?.message || t('activity.report.deadlineError'), 'error')
    } finally {
      setSavingDue(false)
    }
  }

  const backPath = `${basePath}${type === 'assignment' ? '?tab=assignments' : type === 'exam' ? '?tab=exams' : ''}`

  if (state.loading && !state.data) {
    return (
      <div className="p-6 text-sm text-token-textMuted" role="status">
        {t('activity.report.loading')}
      </div>
    )
  }
  if (state.error && !state.data) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <Card className="p-6 text-center">
          <p className="text-sm text-red-700 [.theme-dark_&]:text-red-300">{state.error}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              {t('activity.common.retry')}
            </Button>
            <Link to={backPath}>
              <Button size="sm" variant="ghost">
                {t('activity.report.back')}
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  const kind = type === 'material' ? MATERIAL_KIND[entity?.kind] || MATERIAL_KIND.file : null
  const typeLabel =
    type === 'material'
      ? `${kind.icon} ${t(`activity.kinds.${entity?.kind || 'file'}`, kind.label)}`
      : type === 'assignment'
        ? `📝 ${t('activity.types.assignment')}`
        : `🧪 ${[t('activity.types.exam'), entity?.subject, entity?.topic].filter(Boolean).join(' · ')}`
  const groupText =
    (type === 'assignment' ? entity?.group_name : entity?.group_names?.join(', ')) || t('activity.common.noGroup')
  const avg = type === 'exam' ? averageInfo(entity) : null
  const firstRow = pagination.total ? (pagination.page - 1) * (pagination.page_size || REPORT_PAGE_SIZE) + 1 : 0
  const lastRow = firstRow ? firstRow + students.length - 1 : 0

  return (
    <div className="p-4 sm:p-6 w-full min-w-0 max-w-6xl mx-auto space-y-5">
      <Link to={backPath} className={CTA_LINK}>
        {t('activity.report.back')}
      </Link>

      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-token-textMuted break-words">
              {t(`activity.report.title.${type}`)} · {typeLabel} · {groupText}
            </p>
            <h1 className="font-display font-bold text-xl text-token-textMain break-words [overflow-wrap:anywhere]">{entity?.title}</h1>
            {type === 'exam' ? (
              <p className="mt-1 text-xs text-token-textMuted">
                {entity?.available_from || entity?.available_until ? (
                  <>
                    <DateTimeText iso={entity?.available_from} /> – <DateTimeText iso={entity?.available_until} />
                  </>
                ) : (
                  t('activity.exam.noSchedule')
                )}
              </p>
            ) : null}
            {type === 'assignment' ? (
              <p className="mt-1 text-xs text-token-textMuted">
                {entity?.due_date
                  ? entity.is_overdue
                    ? t('activity.assignment.overdueDue', { date: formatDue(entity.due_date) })
                    : t('activity.assignment.due', { date: formatDue(entity.due_date) })
                  : t('activity.assignment.noDue')}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold tabular-nums">{entity?.completion_pct ?? 0}%</p>
            <p className="text-xs text-token-textMuted">{t('activity.common.assignedOf', { count: entity?.assigned ?? 0 })}</p>
          </div>
        </div>
        <ProgressBar pct={entity?.completion_pct} label={t(`activity.report.title.${type}`)} />
        {entity ? <StatLines type={type} lines={cardLines(type, entity)} columns={2} /> : null}
        {avg ? (
          <p className="text-sm font-semibold">
            {avg.pct != null ? t('activity.exam.averagePct', { pct: avg.pct }) : t('activity.exam.averageScore', { score: avg.score, max: avg.max ?? '—' })}{' '}
            <span className="text-[11px] font-normal text-token-textMuted">({t('activity.exam.averageBasis', { count: avg.count })})</span>
          </p>
        ) : null}
        {type === 'material' ? (
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <div className="flex gap-1">
              <dt className="text-token-textMuted">{t('activity.material.totalViews')}:</dt>
              <dd className="font-semibold">{entity?.total_views ?? 0}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-token-textMuted">{t('activity.material.uniqueDownloaders')}:</dt>
              <dd className="font-semibold">{entity?.unique_downloaders ?? 0}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-token-textMuted">{t('activity.material.totalDownloads')}:</dt>
              <dd className="font-semibold">{entity?.total_downloads ?? 0}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-token-textMuted">{t('activity.material.lastDownload')}:</dt>
              <dd>
                <DateTimeText iso={entity?.last_downloaded_at} />
              </dd>
            </div>
            {entity?.uploaded_by?.full_name ? (
              <div className="flex gap-1">
                <dt className="text-token-textMuted">{t('activity.material.uploader')}:</dt>
                <dd>{entity.uploaded_by.full_name}</dd>
              </div>
            ) : null}
            {entity?.created_at ? (
              <div className="flex gap-1">
                <dt className="text-token-textMuted">{t('activity.material.uploadDate')}:</dt>
                <dd>
                  <DateTimeText iso={entity.created_at} />
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        {type === 'exam' && !readOnly ? (
          <div className="flex flex-wrap gap-3">
            <Link to={`/instructor/analytics?exam=${encodeURIComponent(id)}`} className={CTA_LINK}>
              {t('activity.exam.cta.analytics')}
            </Link>
            <Link to={activityDetailPath('exam', id, { filter: 'completed' })} className={CTA_LINK}>
              {t('activity.exam.cta.results')}
            </Link>
          </div>
        ) : null}
        {type === 'assignment' && !readOnly ? (
          <Link to="/instructor/tasks" className={CTA_LINK}>
            {t('activity.assignment.cta.review')}
          </Link>
        ) : null}
        {type === 'material' && !readOnly ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-token-textMuted">
              {t('activity.report.deadline')}
              <input type="datetime-local" value={dueInput} onChange={(e) => setDueInput(e.target.value)} className={`block mt-1 ${INPUT}`} />
            </label>
            <Button size="sm" variant="secondary" loading={savingDue} onClick={() => void saveDue()}>
              {t('activity.report.save')}
            </Button>
          </div>
        ) : null}
      </Card>

      <section aria-labelledby={filtersId} className="space-y-3">
        <h2 id={filtersId} className="sr-only">
          {t('activity.report.filtersLabel')}
        </h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('activity.report.filtersLabel')}>
          {['', ...REPORT_FILTER_IDS[type]].map((f) => (
            <button
              key={f || 'all'}
              type="button"
              aria-pressed={report.filter === f}
              onClick={() => update({ filter: f })}
              className={`px-3 py-1 rounded-lg border text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                report.filter === f
                  ? 'border-primary bg-primary/15 text-token-textMain'
                  : 'border-[color:var(--border-subtle)] text-token-textMuted hover:text-token-textMain'
              }`}
            >
              {t(`activity.filters.${f || 'all'}`)}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs text-token-textMuted">
            {t('activity.report.search')}
            <input
              type="search"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder={t('activity.report.searchPlaceholder')}
              className={`mt-1 w-full ${INPUT}`}
            />
          </label>
          <label className="text-xs text-token-textMuted">
            {t('activity.report.group')}
            <select value={report.group} onChange={(e) => update({ group: e.target.value })} className={`mt-1 w-full ${INPUT}`}>
              <option value="">{t('activity.report.allGroups')}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-token-textMuted">
            {t('activity.report.status')}
            <select value={report.status} onChange={(e) => update({ status: e.target.value })} className={`mt-1 w-full ${INPUT}`}>
              <option value="">{t('activity.report.anyStatus')}</option>
              {STATUS_IDS[type].map((s) => (
                <option key={s} value={s}>
                  {t(`activity.status.${type}.${s}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-token-textMuted">
            {t('activity.report.from')}
            <input type="date" value={report.from} max={report.to || undefined} onChange={(e) => update({ from: e.target.value })} className={`mt-1 w-full ${INPUT}`} />
          </label>
          <label className="text-xs text-token-textMuted">
            {t('activity.report.to')}
            <input type="date" value={report.to} min={report.from || undefined} onChange={(e) => update({ to: e.target.value })} className={`mt-1 w-full ${INPUT}`} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-token-textMuted">
          <span>{t('activity.report.dateHint')}</span>
          {hasFilters ? (
            <button type="button" className={CTA_LINK} onClick={() => update({ filter: '', status: '', group: '', q: '', from: '', to: '' })}>
              {t('activity.report.reset')}
            </button>
          ) : null}
          <span className="ml-auto font-semibold text-token-textMain" aria-live="polite">
            {t('activity.report.matching', { count: pagination.total })}
          </span>
        </div>
        {readOnly ? null : (
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="secondary" disabled={!selected.size} onClick={() => setReminder({ ids: [...selected] })}>
              {t('activity.report.remindSelected', { count: selected.size })}
            </Button>
            <Button size="sm" onClick={() => setReminder({ ids: null })}>
              {t(`activity.report.remindAll.${type}`)}
            </Button>
          </div>
        )}
      </section>

      <Card className="overflow-hidden">
        {!students.length ? (
          <p className="text-center py-10 text-sm text-token-textMuted">
            {entity?.assigned ? t('activity.report.empty') : t('activity.report.emptyAll')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-token-textMuted">
                  <th scope="col" className="w-10 px-4 py-2">
                    <input
                      type="checkbox"
                      aria-label={t('activity.report.selectAll')}
                      checked={allSelected}
                      disabled={readOnly || !eligible.length}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(eligible.map((s) => s.student_id)))}
                      className="accent-blue-500"
                    />
                  </th>
                  <th scope="col" className="px-2 py-2">{t('activity.report.columns.student')}</th>
                  <th scope="col" className="hidden lg:table-cell px-2 py-2">{t('activity.report.columns.groups')}</th>
                  <th scope="col" className="hidden sm:table-cell px-2 py-2">{t('activity.report.columns.status')}</th>
                  <th scope="col" className="hidden md:table-cell px-2 py-2">{t('activity.report.columns.result')}</th>
                  <th scope="col" className="hidden xl:table-cell px-2 py-2">{t('activity.report.columns.first')}</th>
                  <th scope="col" className="px-2 py-2">{t('activity.report.columns.last')}</th>
                  <th scope="col" className="hidden md:table-cell px-2 py-2 text-right">{t('activity.report.columns.count')}</th>
                  <th scope="col" className="w-10 px-2 py-2">
                    <span className="sr-only">{t('activity.report.timelineTitle')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-subtle)]">
                {students.map((s) => {
                  const meta = statusMeta(type, s)
                  const open = expanded === s.student_id
                  const timelineId = `timeline-${s.student_id}`
                  return (
                    <Fragment key={s.student_id}>
                      <tr className="align-top border-t border-[color:var(--border-subtle)]">
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            aria-label={t('activity.report.selectStudent', { name: s.full_name })}
                            checked={selected.has(s.student_id)}
                            disabled={readOnly || !reminderEligible(type, s)}
                            onChange={() => toggle(s.student_id)}
                            className="accent-blue-500"
                          />
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar id={s.student_id} name={s.full_name} size="md" />
                            <div className="min-w-0">
                              <p className="font-semibold break-words">{s.full_name}</p>
                              <StatusBadge meta={meta} className="sm:hidden mt-1" />
                            </div>
                          </div>
                        </td>
                        <td className="hidden lg:table-cell px-2 py-2.5 text-xs text-token-textMuted">
                          {s.groups?.length ? s.groups.map((g) => g.name).join(', ') : '—'}
                        </td>
                        <td className="hidden sm:table-cell px-2 py-2.5">
                          <StatusBadge meta={meta} />
                        </td>
                        <td className="hidden md:table-cell px-2 py-2.5 text-xs text-token-textMuted">
                          <ResultCell type={type} row={s} />
                        </td>
                        <td className="hidden xl:table-cell px-2 py-2.5 text-xs text-token-textMuted">
                          <DateTimeText iso={s.first_activity_at} />
                        </td>
                        <td className="px-2 py-2.5 text-xs text-token-textMuted">
                          <RelativeTime iso={s.last_activity_at} />
                        </td>
                        <td className="hidden md:table-cell px-2 py-2.5 text-right text-xs tabular-nums">{s.activity_count ?? 0}</td>
                        <td className="px-2 py-2.5">
                          <button
                            type="button"
                            aria-expanded={open}
                            aria-controls={open ? timelineId : undefined}
                            aria-label={t(open ? 'activity.report.hideTimeline' : 'activity.report.showTimeline', { name: s.full_name })}
                            onClick={() => setExpanded(open ? null : s.student_id)}
                            className="rounded-lg px-2 py-1 text-token-textMuted hover:text-token-textMain focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                          >
                            <span aria-hidden="true">{open ? '▴' : '▾'}</span>
                          </button>
                        </td>
                      </tr>
                      {open ? (
                        <tr>
                          <td colSpan={9}>
                            <Timeline type={type} entityId={id} student={s} id={timelineId} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {pagination.total_pages > 1 || pagination.total > 0 ? (
        <nav className="flex flex-wrap items-center justify-between gap-2 text-xs text-token-textMuted" aria-label={t('activity.report.page', { page: pagination.page, pages: pagination.total_pages })}>
          <span>{t('activity.report.showing', { from: firstRow, to: lastRow, total: pagination.total })}</span>
          {pagination.total_pages > 1 ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={pagination.page <= 1 || state.loading} onClick={() => update({ page: pagination.page - 1 })}>
                {t('activity.report.prev')}
              </Button>
              <span>{t('activity.report.page', { page: pagination.page, pages: pagination.total_pages })}</span>
              <Button
                size="sm"
                variant="secondary"
                disabled={pagination.page >= pagination.total_pages || state.loading}
                onClick={() => update({ page: pagination.page + 1 })}
              >
                {t('activity.report.next')}
              </Button>
            </div>
          ) : null}
        </nav>
      ) : null}

      {!readOnly && reminder ? (
        <ReminderDialog
          open
          type={type}
          entityId={id}
          entityTitle={entity?.title}
          candidateIds={reminder.ids}
          onClose={() => setReminder(null)}
          onSent={() => {
            setSelected(new Set())
            void load()
          }}
        />
      ) : null}
    </div>
  )
}
