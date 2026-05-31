import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import { useToast } from '../../components/common/Toast'
import useUiStore from '../../hooks/useUi'
import ErrorBoundary from '../../components/common/ErrorBoundary'
import AssignmentAnswerEditor from '../../components/student/AssignmentAnswerEditor'
import GroupSwitcher from '../../components/student/GroupSwitcher'
import { useStudentGroups } from '../../contexts/StudentGroupContext'
import { bumpStudentAlerts } from '../../hooks/useStudentAlerts'
import { withEnrollmentQuery } from '../../lib/studentGroupQuery'
import {
  assignmentStatusClass,
  assignmentStatusLabel,
  filterTasksByTab,
  isPreviewable,
} from '../../lib/assignmentHelpers'
import {
  assignmentFileLabel,
  assignmentFileOpenUrl,
  isAssignmentPreviewable,
} from '../../lib/assignmentFileUrl'

function fmtDue(d) {
  if (!d) return ''
  return String(d).slice(0, 10)
}

function renderPreview(url) {
  const s = String(url || '').toLowerCase()
  if (s.endsWith('.pdf')) {
    return <iframe title="pdf" src={url} className="w-full h-[60vh] rounded-xl border border-indigo-500/15" />
  }
  if (s.endsWith('.png') || s.endsWith('.jpg') || s.endsWith('.jpeg') || s.endsWith('.webp') || s.endsWith('.gif')) {
    return (
      <img
        src={url}
        alt="preview"
        className="w-full max-h-[60vh] object-contain rounded-xl border border-indigo-500/15 bg-black/20"
      />
    )
  }
  return null
}

function fmtCreated(iso) {
  if (!iso) return ''
  const s = String(iso)
  const d = s.slice(0, 10)
  const t = s.slice(11, 16)
  return t ? `${d} ${t}` : d
}

export default function StudentAssignments() {
  const { activeEnrollmentId, activeEnrollment } = useStudentGroups()
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [err, setErr] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const toast = useToast()
  const [openId, setOpenId] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailErr, setDetailErr] = useState(null)
  const [detail, setDetail] = useState(null)
  const [editorHtml, setEditorHtml] = useState('')
  const [attachments, setAttachments] = useState([])
  const [tab, setTab] = useState('active')
  const { setFocusMode } = useUiStore()

  const filteredTasks = useMemo(() => filterTasksByTab(tasks, tab), [tasks, tab])

  const markTaskSeenLocally = useCallback((studentAssignmentId, seenAt) => {
    const when = seenAt || new Date().toISOString()
    setTasks((prev) =>
      prev
        .filter(Boolean)
        .map((t) =>
          String(t.assignment_id) === String(studentAssignmentId)
            ? { ...t, seen_at: t.seen_at || when }
            : t,
        ),
    )
  }, [])

  const newTaskCount = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t &&
          !t.seen_at &&
          !t.submitted_at &&
          ['pending', 'overdue'].includes(t.display_status || t.status),
      ).length,
    [tasks],
  )

  useEffect(() => {
    return () => setFocusMode(false)
  }, [setFocusMode])

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const d = await api.get(withEnrollmentQuery('/tasks/my', activeEnrollmentId))
      const list = Array.isArray(d.tasks) ? d.tasks : []
      setTasks(list.filter((t) => t && t.assignment_id != null))
    } catch (e) {
      setErr(e?.message || 'Yüklənmədi')
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [activeEnrollmentId])

  useEffect(() => {
    void load()
  }, [load])

  const openWorkspace = async (assignmentId) => {
    markTaskSeenLocally(assignmentId)
    bumpStudentAlerts()
    setOpenId(assignmentId)
    setFocusMode(true)
    setDetail(null)
    setEditorHtml('')
    setAttachments([])
    setDetailErr(null)
    setDetailLoading(true)
    try {
      const d = await api.get('/tasks/assignments/' + encodeURIComponent(assignmentId))
      const a = d.assignment
      setDetail(a)
      setEditorHtml(a?.answer_text || '')
      setAttachments(Array.isArray(a?.attachment_urls) ? a.attachment_urls : [])
      markTaskSeenLocally(assignmentId, a?.seen_at)
      bumpStudentAlerts()
    } catch (e) {
      setDetailErr(e?.message || 'Yüklənmədi')
    } finally {
      setDetailLoading(false)
    }
  }

  const locked =
    Boolean(detail?.submitted_at) ||
    ['submitted', 'reviewed', 'late', 'late_rejected', 'completed'].includes(detail?.status)

  const saveDraft = async () => {
    if (!openId) return
    setBusyId('draft')
    try {
      const d = await api.patch('/tasks/assignments/' + encodeURIComponent(openId) + '/draft', {
        answer_text: editorHtml,
        attachment_urls: attachments,
      })
      setDetail((p) => ({ ...(p || {}), ...(d.assignment || {}) }))
      toast('Qaralama saxlanıldı', 'success')
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const submitWork = async () => {
    if (!openId) return
    if (!window.confirm('Təslim edilsin? Təslim etdikdən sonra dəyişiklik etmək mümkün olmayacaq.')) return
    setBusyId('submit')
    try {
      const d = await api.patch('/tasks/assignments/' + encodeURIComponent(openId) + '/submit', {
        answer_text: editorHtml,
        attachment_urls: attachments,
      })
      setDetail((p) => ({ ...(p || {}), ...(d.assignment || {}), status: 'completed' }))
      toast('Təslim edildi', 'success')
      await load()
      bumpStudentAlerts()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const uploadFiles = async (files) => {
    const list = Array.from(files || [])
    if (!list.length) return
    setBusyId('upload')
    try {
      const next = [...attachments]
      for (const f of list) {
        const fd = new FormData()
        fd.append('file', f)
        const r = await api.post('/tasks/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        if (r?.url) next.push(r.url)
      }
      setAttachments(next)
      toast('Fayl yükləndi', 'success')
    } catch (e) {
      toast(e?.message || 'Fayl yüklənmədi', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const removeAttachment = (url) => {
    setAttachments((p) => p.filter((x) => x !== url))
  }

  return (
    <div className="p-4 sm:p-6 w-full min-w-0 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-1 min-w-0 pl-14 sm:pl-0">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain">Tapşırıqlarım</h1>
            {activeEnrollment && (
              <p className="text-sm text-token-textMuted mt-1">
                {activeEnrollment.group_name} • {activeEnrollment.instructor_name}
              </p>
            )}
            <p className="text-token-textMuted text-sm mt-1">Müəllimin sizə göndərdiyi tapşırıqlar.</p>
          </div>
          <GroupSwitcher className="w-full sm:w-auto sm:min-w-[200px] shrink-0" />
        </div>
        <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
          Yenilə
        </Button>
      </div>

      {err && (
        <Card className="p-4 border border-red-500/30 bg-red-500/10 text-red-200 mb-4">
          {err}
        </Card>
      )}

      {newTaskCount > 0 && (
        <Card className="p-4 mb-4 border border-violet-500/35 bg-gradient-to-r from-violet-500/15 to-indigo-500/10">
          <div className="flex flex-wrap items-start gap-3">
            <span className="text-2xl" aria-hidden>
              📋
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-violet-100">
                {newTaskCount === 1 ? 'Yeni tapşırıq' : `${newTaskCount} yeni tapşırıq`}
              </p>
              <p className="text-xs text-gray-300 mt-1">
                Bu qrupda gözləyən tapşırıqlar var — aşağıdakı siyahıdan açın və təslim edin.
              </p>
            </div>
            <span className="shrink-0 text-xs font-bold tabular-nums px-2.5 py-1 rounded-full bg-violet-500 text-white">
              {newTaskCount}
            </span>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { id: 'active', label: 'Aktiv' },
          { id: 'completed', label: 'Tamamlanmış' },
          { id: 'overdue', label: 'Gecikmiş' },
        ].map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setTab(x.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              tab === x.id
                ? 'bg-indigo-600/45 border-indigo-400/55 text-white'
                : 'border-indigo-500/20 text-gray-500'
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Card hover className="p-5 text-sm text-token-textMuted border border-[color:var(--border-subtle)] hover:border-primary/20">
          Yüklənir…
        </Card>
      ) : filteredTasks.length === 0 ? (
        <Card hover className="p-5 text-sm text-token-textMuted border border-[color:var(--border-subtle)] hover:border-primary/20">
          Bu bölmədə tapşırıq yoxdur.
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((t) => {
            const st = t.display_status || t.status
            const done = ['submitted', 'reviewed', 'late', 'completed'].includes(st)
            const isNew = !t.seen_at && !t.submitted_at
            return (
              <Card
                key={t.assignment_id}
                hover
                className={[
                  'p-5 border hover:border-primary/20',
                  isNew
                    ? 'border-violet-500/40 ring-1 ring-violet-400/25 bg-violet-500/5'
                    : 'border-[color:var(--border-subtle)]',
                ].join(' ')}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-token-textMain font-semibold break-words flex flex-wrap items-center gap-2">
                      {t.title}
                      {isNew ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-violet-200 bg-violet-500/30 px-2 py-0.5 rounded-full">
                          Yeni
                        </span>
                      ) : null}
                    </p>
                    {t.topic ? (
                      <p className="text-sm text-indigo-200/90 mt-1 break-words">Mövzu: {t.topic}</p>
                    ) : null}
                    <p className="text-xs text-token-textMuted mt-1">
                      Müəllim: <span className="text-token-textMain">{t.instructor_name}</span>
                      {t.assignment_created_at ? (
                        <>
                          {' '}
                          · Yaradılıb:{' '}
                          <span className="text-token-textMain font-mono">{fmtCreated(t.assignment_created_at)}</span>
                        </>
                      ) : null}
                      {t.due_date ? (
                        <>
                          {' '}
                          · Son tarix: <span className="text-token-textMain font-mono">{fmtDue(t.due_date)}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${assignmentStatusClass(t.status, st)}`}>
                      {assignmentStatusLabel(t.status, st)}
                    </span>
                    <Button size="sm" variant="secondary" onClick={() => void openWorkspace(t.assignment_id)}>
                      Aç
                    </Button>
                  </div>
                </div>
                {t.description ? (
                  <div className="mt-3 text-sm text-token-textMain whitespace-pre-wrap leading-relaxed border-t border-[color:var(--border-subtle)] pt-3">
                    <span className="text-xs font-semibold text-token-textMuted uppercase tracking-wider">Müəllim qeydi</span>
                    <div className="mt-1">{t.description}</div>
                  </div>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={Boolean(openId)}
        onClose={() => {
          if (busyId) return null
          setOpenId(null)
          setFocusMode(false)
          void load()
          bumpStudentAlerts()
        }}
        title={detail?.title ? `Tapşırıq — ${detail.title}` : 'Tapşırıq'}
        size="xl"
      >
        {detailLoading ? (
          <p className="text-sm text-gray-500">Yüklənir…</p>
        ) : detailErr ? (
          <p className="text-sm text-amber-200/90">{detailErr}</p>
        ) : detail ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/50 p-3">
              <p className="text-sm text-white font-semibold break-words">{detail.title}</p>
              {detail.topic ? <p className="text-sm text-indigo-200/90 mt-1">Mövzu: {detail.topic}</p> : null}
              {detail.question_file_url ? (
                <div className="mt-2">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Tapşırıq faylı</p>
                  <a
                    className="inline-flex items-center gap-2 mt-1 text-sm font-semibold text-blue-300 hover:text-blue-200"
                    href={assignmentFileOpenUrl(detail.question_file_url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    📎 {assignmentFileLabel(detail.question_file_url)}
                  </a>
                  <p className="text-[11px] text-gray-500 mt-1">Yeni pəncərədə açılır və ya yüklənir (Word/PDF).</p>
                </div>
              ) : null}
              <p className="text-xs text-gray-500 mt-1">
                Müəllim: <span className="text-gray-300">{detail.instructor_name}</span>
                {detail.assignment_created_at ? (
                  <>
                    {' '}
                    · Yaradılıb: <span className="text-gray-300 font-mono">{fmtCreated(detail.assignment_created_at)}</span>
                  </>
                ) : null}
                {detail.due_date ? (
                  <>
                    {' '}
                    · Son tarix: <span className="text-gray-300 font-mono">{fmtDue(detail.due_date)}</span>
                  </>
                ) : null}
                {detail.submitted_at ? (
                  <>
                    {' '}
                    · Təslim: <span className="text-gray-300 font-mono">{fmtCreated(detail.submitted_at)}</span>
                  </>
                ) : null}
                {detail.reviewed_at ? (
                  <>
                    {' '}
                    · Yoxlama: <span className="text-gray-300 font-mono">{fmtCreated(detail.reviewed_at)}</span>
                  </>
                ) : null}
              </p>
              {detail.score != null ? (
                <p className="text-sm text-emerald-200/95 mt-2 font-semibold">
                  Bal: {detail.score}
                  {detail.max_score != null ? ` / ${detail.max_score}` : ''}
                </p>
              ) : null}
              {detail.feedback ? (
                <div className="mt-2 text-sm text-gray-200 whitespace-pre-wrap rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <span className="text-xs font-semibold text-emerald-300/90 uppercase">Müəllim rəyi</span>
                  <div className="mt-1">{detail.feedback}</div>
                </div>
              ) : null}
              {detail.description ? (
                <div className="mt-3 text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Müəllim qeydi</span>
                  <div className="mt-1">{detail.description}</div>
                </div>
              ) : null}
            </div>

            {detail.question_file_url && isAssignmentPreviewable(detail.question_file_url) && (
              <div className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/40 p-3">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Tapşırıq faylı — ön baxış</p>
                <div className="mt-2">{renderPreview(assignmentFileOpenUrl(detail.question_file_url))}</div>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Cavab</p>
              <p className="text-[11px] text-gray-500 mb-2">
                Mətn yazın və ya aşağıdan fayl yükləyin — hər ikisi də qəbul edilir.
              </p>
              <div className={`assignment-answer-editor rounded-xl overflow-hidden border border-indigo-500/20 ${locked ? 'opacity-95 pointer-events-none' : ''}`}>
                <ErrorBoundary title="Cavab redaktoru açılmadı">
                  <AssignmentAnswerEditor
                    value={editorHtml}
                    onChange={setEditorHtml}
                    readOnly={locked}
                  />
                </ErrorBoundary>
              </div>
              <style>{`
                .assignment-answer-editor .ql-toolbar {
                  border-color: rgba(99, 102, 241, 0.25);
                  background: rgba(15, 12, 41, 0.6);
                }
                .assignment-answer-editor .ql-container {
                  border-color: rgba(99, 102, 241, 0.25);
                  background: rgba(19, 17, 46, 0.85);
                  min-height: 280px;
                  font-size: 15px;
                }
                .assignment-answer-editor .ql-editor {
                  min-height: 240px;
                  color: #f3f4f6;
                }
              `}</style>
              {locked ? (
                <p className="text-xs text-amber-200/90 mt-2">Bu tapşırıq təslim edilib — redaktə bağlanıb.</p>
              ) : null}
            </div>

            <div
              className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/40 p-3"
              onDragOver={(e) => {
                if (locked) return
                e.preventDefault()
              }}
              onDrop={(e) => {
                if (locked) return
                e.preventDefault()
                void uploadFiles(e.dataTransfer.files)
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Fayllar</p>
                {!locked && (
                  <label className="text-xs font-semibold text-blue-400 hover:text-blue-300 cursor-pointer">
                    + Yüklə (PDF, Word, şəkil, ZIP)
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip,application/pdf,image/png,image/jpeg,application/zip"
                      className="hidden"
                      onChange={(e) => void uploadFiles(e.target.files)}
                    />
                  </label>
                )}
              </div>
              {!locked && (
                <p className="text-[11px] text-gray-500 mb-2">
                  Buraya sürüşdürüb-buraxın (drag & drop) və ya yuxarıdan seçin.
                </p>
              )}
              {!attachments.length ? (
                <p className="text-sm text-gray-500">Fayl yoxdur.</p>
              ) : (
                <ul className="space-y-2">
                  {attachments.map((u) => (
                    <li key={u} className="flex items-center justify-between gap-2">
                      <a
                        className="text-sm text-blue-300 hover:text-blue-200 break-all"
                        href={assignmentFileOpenUrl(u)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {assignmentFileLabel(u)}
                      </a>
                      {!locked && (
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-300 hover:text-red-200 shrink-0"
                          onClick={() => removeAttachment(u)}
                        >
                          Sil
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setOpenId(null)
                  setFocusMode(false)
                }}
                disabled={Boolean(busyId)}
              >
                Bağla
              </Button>
              <Button
                variant="secondary"
                onClick={() => void saveDraft()}
                loading={busyId === 'draft' || busyId === 'upload'}
                disabled={locked}
              >
                Qaralama kimi saxla
              </Button>
              <Button onClick={() => void submitWork()} loading={busyId === 'submit'} disabled={locked}>
                Təslim et
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
