import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import { useToast } from '../../components/common/Toast'
import useUiStore from '../../hooks/useUi'
import { BILLING_STATUS_QUERY_KEY, useBillingStatus } from '../../hooks/useBillingStatus'
import { assignmentStatusClass, assignmentStatusLabel } from '../../lib/assignmentHelpers'

function fmtDue(d) {
  if (!d) return ''
  return String(d).slice(0, 10)
}

function fmtCreated(iso) {
  if (!iso) return ''
  const s = String(iso)
  const d = s.slice(0, 10)
  const t = s.slice(11, 16)
  return t ? `${d} ${t}` : d
}

function isPreviewable(url) {
  const s = String(url || '').toLowerCase()
  return s.endsWith('.png') || s.endsWith('.jpg') || s.endsWith('.jpeg') || s.endsWith('.webp') || s.endsWith('.gif') || s.endsWith('.pdf')
}

function renderPreview(url) {
  const s = String(url || '').toLowerCase()
  if (s.endsWith('.pdf')) {
    return <iframe title="pdf" src={url} className="w-full h-[60vh] rounded-xl border border-indigo-500/15" />
  }
  if (s.endsWith('.png') || s.endsWith('.jpg') || s.endsWith('.jpeg') || s.endsWith('.webp') || s.endsWith('.gif')) {
    return <img src={url} alt="preview" className="w-full max-h-[60vh] object-contain rounded-xl border border-indigo-500/15 bg-black/20" />
  }
  return null
}

export default function InstructorTasks() {
  const [loading, setLoading] = useState(true)
  const [studentsLoading, setStudentsLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [students, setStudents] = useState([])
  const [err, setErr] = useState(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewErr, setReviewErr] = useState(null)
  const [review, setReview] = useState(null)
  const [reviewScore, setReviewScore] = useState('')
  const [reviewFeedback, setReviewFeedback] = useState('')
  const [reviewSaving, setReviewSaving] = useState(false)
  const [groups, setGroups] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const toast = useToast()
  const { setFocusMode } = useUiStore()
  const queryClient = useQueryClient()
  const billingQ = useBillingStatus()
  const billing = billingQ.data || null
  const blocked = Boolean(billing?.should_block)

  const [form, setForm] = useState({
    title: '',
    topic: '',
    question_file_url: '',
    description: '',
    due_date: '',
    max_score: '',
    group_id: '',
    selectedStudentIds: [],
  })

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const d = await api.get('/tasks')
      setTasks(Array.isArray(d.tasks) ? d.tasks : [])
    } catch (e) {
      setErr(e?.message || 'Yüklənmədi')
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadStudents = useCallback(async () => {
    setStudentsLoading(true)
    try {
      const d = await api.get('/students')
      setStudents(Array.isArray(d.students) ? d.students : [])
    } catch {
      setStudents([])
    } finally {
      setStudentsLoading(false)
    }
  }, [])

  const loadGroups = useCallback(async () => {
    try {
      const d = await api.get('/tasks/groups')
      setGroups(Array.isArray(d.groups) ? d.groups : [])
    } catch {
      setGroups([])
    }
  }, [])

  const loadAnalytics = useCallback(async () => {
    try {
      const d = await api.get('/tasks/analytics')
      setAnalytics(d.analytics || null)
    } catch {
      setAnalytics(null)
    }
  }, [])

  useEffect(() => {
    void load()
    void loadStudents()
    void loadGroups()
    void loadAnalytics()
  }, [load, loadStudents, loadGroups, loadAnalytics])

  const stats = useMemo(() => {
    const total = tasks.reduce((s, t) => s + (t.assigned_count || 0), 0)
    const done = tasks.reduce((s, t) => s + (t.done_count || 0), 0)
    return { total, done }
  }, [tasks])

  const toggleStudent = (studentId) => {
    setForm((p) => {
      const set = new Set(p.selectedStudentIds)
      if (set.has(studentId)) set.delete(studentId)
      else set.add(studentId)
      return { ...p, selectedStudentIds: [...set] }
    })
  }

  const submit = async () => {
    if (blocked) {
      toast(billing?.messages?.banner || 'Məhdudiyyətə görə bu əməliyyat deaktivdir', 'error')
      return
    }
    const title = String(form.title || '').trim()
    if (!title) {
      toast('Tapşırığın adı tələb olunur', 'error')
      return
    }
    if (!form.selectedStudentIds.length) {
      toast('Ən azı bir tələbə seçin', 'error')
      return
    }
    setSaving(true)
    try {
      const d = await api.post('/tasks', {
        title,
        topic: form.topic || null,
        question_file_url: form.question_file_url || null,
        description: form.description || null,
        due_date: form.due_date || null,
        max_score: form.max_score ? Number(form.max_score) : null,
        group_id: form.group_id || null,
        student_ids: form.selectedStudentIds,
      })
      toast(`Göndərildi (${d.assignedCount || 0} tələbə)`, 'success')
      setOpen(false)
      setForm({
        title: '',
        topic: '',
        question_file_url: '',
        description: '',
        due_date: '',
        max_score: '',
        group_id: '',
        selectedStudentIds: [],
      })
      await load()
      queryClient.invalidateQueries({ queryKey: BILLING_STATUS_QUERY_KEY })
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setSaving(false)
    }
  }

  const uploadQuestionFile = async (file) => {
    if (blocked) {
      toast(billing?.messages?.banner || 'Məhdudiyyətə görə bu əməliyyat deaktivdir', 'error')
      return
    }
    if (!file) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await api.post('/tasks/instructor/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      if (r?.url) {
        setForm((p) => ({ ...p, question_file_url: r.url }))
        toast('Fayl yükləndi', 'success')
        queryClient.invalidateQueries({ queryKey: BILLING_STATUS_QUERY_KEY })
      }
    } catch (e) {
      toast(e?.message || 'Fayl yüklənmədi', 'error')
    } finally {
      setSaving(false)
    }
  }

  const removeTask = async (id, title) => {
    if (!window.confirm(`«${title}» silinsin? Tələbə siyahısından da silinəcək.`)) return
    setDeletingId(id)
    try {
      await api.delete('/tasks/' + encodeURIComponent(id))
      toast('Silindi', 'success')
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const parseRecipients = (t) => {
    const r = t.recipients
    if (Array.isArray(r)) return r
    if (r && typeof r === 'string') {
      try {
        const j = JSON.parse(r)
        return Array.isArray(j) ? j : []
      } catch {
        return []
      }
    }
    return []
  }

  const openReview = async (studentAssignmentId) => {
    setReviewOpen(true)
    setFocusMode(true)
    setReviewLoading(true)
    setReviewErr(null)
    setReview(null)
    setReviewScore('')
    setReviewFeedback('')
    try {
      const d = await api.get('/tasks/instructor/review/' + encodeURIComponent(studentAssignmentId))
      const r = d.review || null
      setReview(r)
      setReviewScore(r?.score != null ? String(r.score) : '')
      setReviewFeedback(r?.feedback || '')
    } catch (e) {
      setReviewErr(e?.message || 'Yüklənmədi')
    } finally {
      setReviewLoading(false)
    }
  }

  const saveReview = async () => {
    if (!review?.student_assignment_id) return
    setReviewSaving(true)
    try {
      const body = {
        feedback: reviewFeedback,
        score: reviewScore !== '' ? Number(reviewScore) : undefined,
      }
      const d = await api.patch('/tasks/instructor/review/' + encodeURIComponent(review.student_assignment_id), body)
      setReview(d.review || review)
      toast('Rəy saxlanıldı', 'success')
      await load()
      await loadAnalytics()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setReviewSaving(false)
    }
  }

  const decideLate = async (decision) => {
    if (!review?.student_assignment_id) return
    setReviewSaving(true)
    try {
      const d = await api.patch('/tasks/instructor/review/' + encodeURIComponent(review.student_assignment_id), {
        late_decision: decision,
      })
      setReview(d.review || review)
      toast(decision === 'accepted' ? 'Gecikmiş təslim qəbul edildi' : 'Gecikmiş təslim rədd edildi', 'success')
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setReviewSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 w-full min-w-0 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain">Tapşırıqlar</h1>
          <p className="text-token-textMuted text-sm mt-1">
            Ev tapşırığı verin, təslimləri yoxlayın, bal və rəy yazın.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link
            to="/instructor/tasks/analytics"
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/10"
          >
            Analitika
          </Link>
          <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            Yenilə
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            + Yeni tapşırıq
          </Button>
        </div>
      </div>

      {err && (
        <Card className="p-4 border border-red-500/30 bg-red-500/10 text-red-200 mb-4">
          {err}
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card hover className="p-4">
          <p className="text-xs text-token-textMuted">Tapşırıqlar</p>
          <p className="text-lg font-bold text-token-textMain mt-1">{tasks.length}</p>
        </Card>
        <Card hover className="p-4">
          <p className="text-xs text-token-textMuted">Təyinat (cəmi)</p>
          <p className="text-lg font-bold text-token-textMain mt-1">{stats.total}</p>
        </Card>
        <Card hover className="p-4">
          <p className="text-xs text-token-textMuted">Təslim nisbəti</p>
          <p className="text-lg font-bold text-token-textMain mt-1">
            {analytics?.submission_rate != null ? `${analytics.submission_rate}%` : '—'}
          </p>
        </Card>
        <Card hover className="p-4">
          <p className="text-xs text-token-textMuted">Orta bal</p>
          <p className="text-lg font-bold text-token-textMain mt-1">
            {analytics?.average_score != null ? analytics.average_score : '—'}
          </p>
        </Card>
      </div>

      {loading ? (
        <Card hover className="p-5 text-sm text-token-textMuted">
          Yüklənir…
        </Card>
      ) : tasks.length === 0 ? (
        <Card hover className="p-5 text-sm text-token-textMuted">
          Hələ tapşırıq yoxdur.
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => {
            const recipients = parseRecipients(t)
            return (
              <Card key={t.id} hover className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-token-textMain font-semibold break-words">{t.title}</p>
                    {t.topic ? (
                      <p className="text-sm text-token-textMuted mt-1 break-words">Mövzu: {t.topic}</p>
                    ) : null}
                    <p className="text-xs text-token-textMuted mt-1">
                      Yaradılıb: <span className="text-token-textMain font-mono">{fmtCreated(t.created_at)}</span>
                      {t.due_date ? (
                        <>
                          {' '}
                          · Son tarix: <span className="text-token-textMain font-mono">{fmtDue(t.due_date)}</span>
                        </>
                      ) : null}
                      {t.group_name ? (
                        <>
                          {' '}
                          · Qrup: <span className="text-token-textMain">{t.group_name}</span>
                        </>
                      ) : null}
                      {t.max_score ? (
                        <>
                          {' '}
                          · Max: <span className="text-token-textMain">{t.max_score}</span>
                        </>
                      ) : null}
                      <span className="block sm:inline sm:ml-1 mt-0.5 sm:mt-0">
                        · Təyin: {t.assigned_count || 0} · Təslim: {t.submitted_count || 0} · Gözləyir:{' '}
                        {t.pending_count || 0}
                      </span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="danger"
                    loading={deletingId === t.id}
                    onClick={() => void removeTask(t.id, t.title)}
                    className="shrink-0"
                  >
                    Sil
                  </Button>
                </div>
                {t.description ? (
                  <div className="mt-3 text-sm text-token-textMain whitespace-pre-wrap leading-relaxed border-t border-[color:var(--border-subtle)] pt-3">
                    <span className="text-xs font-semibold text-token-textMuted uppercase tracking-wider">Müəllim qeydi</span>
                    <div className="mt-1">{t.description}</div>
                  </div>
                ) : null}
                {recipients.length > 0 ? (
                  <div className="mt-3 rounded-xl border border-indigo-500/15 bg-[#0f0c29]/50 p-3">
                    <p className="text-[10px] font-semibold text-token-textMuted uppercase tracking-wider mb-2">Tələbələr və status</p>
                    <ul className="space-y-1.5">
                      {recipients.map((r) => (
                        <li key={r.student_id} className="flex items-center justify-between gap-2 text-sm min-w-0">
                          <span className="text-token-textMain truncate">{r.full_name || 'Tələbə'}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${assignmentStatusClass(r.status)}`}
                            >
                              {assignmentStatusLabel(r.status)}
                            </span>
                            {['submitted', 'late', 'reviewed', 'completed'].includes(r.status) ? (
                              <Button size="sm" variant="secondary" onClick={() => void openReview(r.student_assignment_id)}>
                                Yoxla
                              </Button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={() => (saving ? null : setOpen(false))} title="Yeni tapşırıq" size="lg">
        <div className="space-y-4 max-h-[min(70vh,32rem)] overflow-y-auto pr-1">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ad (başlıq) *</label>
            <input
              className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Məsələn: Ev tapşırığı — trigonometriya"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Mövzu</label>
            <input
              className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={form.topic}
              onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))}
              placeholder="Məsələn: Dairə və çevrə"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Müəllim qeydi</label>
            <textarea
              rows={4}
              className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500 resize-none"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Tapşırıq haqqında qeyd…"
            />
          </div>
          <div className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/40 p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tapşırıq faylı (PDF/Word/Excel/CSV/Şəkil)</p>
              <label className="text-xs font-semibold text-blue-400 hover:text-blue-300 cursor-pointer">
                + Yüklə
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xlsx,.xls,.ppt,.pptx,.csv,.zip,application/pdf,image/png,image/jpeg,application/zip"
                  onChange={(e) => void uploadQuestionFile(e.target.files?.[0])}
                  disabled={blocked}
                />
              </label>
            </div>
            {form.question_file_url ? (
              <a className="text-sm text-blue-300 hover:text-blue-200 break-all" href={form.question_file_url} target="_blank" rel="noreferrer">
                {form.question_file_url}
              </a>
            ) : (
              <p className="text-sm text-gray-500">Fayl yoxdur.</p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Son tarix</label>
              <input
                type="date"
                className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                value={form.due_date}
                onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Max bal (ixtiyari)</label>
              <input
                type="number"
                min={1}
                className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                value={form.max_score}
                onChange={(e) => setForm((p) => ({ ...p, max_score: e.target.value }))}
                placeholder="100"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Qrup (hamısına təyin)</label>
            <select
              className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={form.group_id}
              onChange={(e) => setForm((p) => ({ ...p, group_id: e.target.value }))}
            >
              <option value="">— Qrup seçin (ixtiyari) —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.subject_name ? `${g.subject_name} · ` : ''}
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="border-t border-indigo-500/20 pt-3">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Tələbələr * (bir və ya bir neçə)
            </label>
            {studentsLoading ? (
              <p className="text-sm text-gray-500">Tələbələr yüklənir…</p>
            ) : !students.length ? (
              <p className="text-sm text-amber-200/90">Aktiv tələbə yoxdur — əvvəlcə «Tələbələrim»dən əlavə edin.</p>
            ) : !students.filter((s) => (s.enrollment_status || 'active') === 'active').length ? (
              <p className="text-sm text-amber-200/90">Aktiv qeydiyyatlı tələbə yoxdur.</p>
            ) : (
              <ul className="max-h-48 overflow-y-auto space-y-2 rounded-xl border border-indigo-500/15 p-2 bg-[#0f0c29]/40">
                {students
                  .filter((s) => (s.enrollment_status || 'active') === 'active')
                  .map((s) => {
                  const sid = s.id
                  const checked = sid && form.selectedStudentIds.includes(sid)
                  return (
                    <li key={s.enrollment_id || sid}>
                      <label className="flex items-center gap-3 cursor-pointer px-2 py-1.5 rounded-lg hover:bg-white/5">
                        <input
                          type="checkbox"
                          className="rounded border-indigo-500/40 text-blue-500 focus:ring-blue-500/30"
                          checked={!!checked}
                          onChange={() => sid && toggleStudent(sid)}
                          disabled={!sid}
                        />
                        <span className="text-sm text-white truncate">{s.full_name}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="flex gap-2 justify-end pt-2 sticky bottom-0 bg-[#1a1740] pb-1 -mb-1">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Ləğv et
            </Button>
            <Button onClick={() => void submit()} loading={saving}>
              Göndər
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={reviewOpen}
        onClose={() => {
          if (reviewLoading) return null
          setReviewOpen(false)
          setFocusMode(false)
        }}
        title={review?.student_name ? `Yoxla — ${review.student_name}` : 'Yoxla'}
        size="xl"
      >
        {reviewLoading ? (
          <p className="text-sm text-gray-500">Yüklənir…</p>
        ) : reviewErr ? (
          <p className="text-sm text-amber-200/90">{reviewErr}</p>
        ) : review ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/50 p-3">
              <p className="text-sm text-white font-semibold break-words">{review.title}</p>
              {review.topic ? <p className="text-sm text-indigo-200/90 mt-1">Mövzu: {review.topic}</p> : null}
              {review.question_file_url ? (
                <p className="text-xs text-gray-500 mt-1 break-all">
                  Tapşırıq faylı:{' '}
                  <a className="text-blue-300 hover:text-blue-200" href={review.question_file_url} target="_blank" rel="noreferrer">
                    {review.question_file_url}
                  </a>
                </p>
              ) : null}
              <p className="text-xs text-gray-500 mt-1 font-mono tabular-nums">
                {review.submitted_at ? `Təslim: ${fmtCreated(review.submitted_at)}` : 'Təslim edilməyib'}
              </p>
            </div>

            <div className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/40 p-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Tələbənin cavabı</p>
              {review.answer_text ? (
                <div
                  className="prose prose-invert max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: review.answer_text }}
                />
              ) : (
                <p className="text-sm text-gray-500">Cavab yoxdur.</p>
              )}
            </div>

            <div className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/40 p-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Fayllar</p>
              {Array.isArray(review.attachment_urls) && review.attachment_urls.length ? (
                <ul className="space-y-2">
                  {review.attachment_urls.map((u) => (
                    <li key={u}>
                      <a className="text-sm text-blue-300 hover:text-blue-200 break-all" href={u} target="_blank" rel="noreferrer">
                        {u}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">Fayl yoxdur.</p>
              )}
            </div>

            {Array.isArray(review.attachment_urls) && review.attachment_urls.some(isPreviewable) && (
              <div className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/40 p-3">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Ön baxış (PDF / şəkil)</p>
                <div className="space-y-4">
                  {review.attachment_urls
                    .filter((u) => isPreviewable(u))
                    .map((u) => (
                      <div key={`pv-${u}`} className="space-y-2">
                        <a className="text-xs text-blue-300 break-all" href={u} target="_blank" rel="noreferrer">
                          {u}
                        </a>
                        {renderPreview(u)}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {review.question_file_url && isPreviewable(review.question_file_url) && (
              <div className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/40 p-3">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Tapşırıq faylı — ön baxış
                </p>
                <a className="text-xs text-blue-300 break-all" href={review.question_file_url} target="_blank" rel="noreferrer">
                  {review.question_file_url}
                </a>
                <div className="mt-2">{renderPreview(review.question_file_url)}</div>
              </div>
            )}

            {review.status === 'late' && !review.late_decision ? (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 flex flex-wrap gap-2">
                <p className="text-sm text-amber-100 w-full">Gecikmiş təslim — qəbul və ya rədd edin.</p>
                <Button size="sm" onClick={() => void decideLate('accepted')} loading={reviewSaving}>
                  Gecikməni qəbul et
                </Button>
                <Button size="sm" variant="danger" onClick={() => void decideLate('rejected')} loading={reviewSaving}>
                  Rədd et
                </Button>
              </div>
            ) : null}

            <div className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/40 p-3 space-y-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Qiymət və rəy</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={review.max_score || undefined}
                  className="w-28 bg-[#13112e] border border-indigo-500/20 rounded-lg px-3 py-2 text-white text-sm"
                  value={reviewScore}
                  onChange={(e) => setReviewScore(e.target.value)}
                  placeholder={review.max_score ? `0–${review.max_score}` : 'Bal'}
                />
                {review.max_score ? (
                  <span className="text-sm text-gray-400">/ {review.max_score}</span>
                ) : null}
              </div>
              <textarea
                rows={4}
                className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-3 py-2 text-white text-sm resize-none"
                value={reviewFeedback}
                onChange={(e) => setReviewFeedback(e.target.value)}
                placeholder="Rəy (məs: Loops hissəsində səhvlər var)"
              />
              <Button onClick={() => void saveReview()} loading={reviewSaving}>
                Rəyi saxla
              </Button>
            </div>

            <Button
              variant="secondary"
              className="w-full justify-center"
              onClick={() => {
                setReviewOpen(false)
                setFocusMode(false)
              }}
            >
              Bağla
            </Button>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
