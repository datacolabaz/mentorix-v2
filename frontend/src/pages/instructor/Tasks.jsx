import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { copyStudentTaskLink } from '../../lib/taskShare'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import { useToast } from '../../components/common/Toast'
import { BILLING_STATUS_QUERY_KEY, useBillingStatus } from '../../hooks/useBillingStatus'
import { isInstructorBillingBlocked, HOMEWORK_MONTHLY_LIMIT_MESSAGE, isHomeworksMonthlyLimitReached, basicTrialExpiredMessage } from '../../lib/subscriptionPlanGuards'
import { useSubscriptionPlans } from '../../hooks/useSubscriptionPlans'
import { assignmentStatusClass } from '../../lib/assignmentHelpers'
import { assignmentFileLabel, assignmentFileOpenUrl, isAssignmentPreviewable } from '../../lib/assignmentFileUrl'
import LibraryMaterialPickerModal from '../../components/instructor/LibraryMaterialPickerModal'

const BAKU_TZ = 'Asia/Baku'

function fmtLocaleField(row, key, locale) {
  const iso = row?.[key]
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(locale === 'ru' ? 'ru-RU' : 'az-AZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: BAKU_TZ,
    })
  } catch {
    return ''
  }
}

function fmtDue(d, locale) {
  if (!d) return ''
  const s = String(d).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  try {
    return new Date(`${s}T12:00:00`).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'az-AZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return s
  }
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
  const { t, i18n } = useTranslation()
  const taskStatusLabel = (status) =>
    t(`tasks.status.${status}`, { defaultValue: status || t('tasks.status.pending') })
  const [loading, setLoading] = useState(true)
  const [studentsLoading, setStudentsLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [students, setStudents] = useState([])
  const [err, setErr] = useState(null)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [fileUploading, setFileUploading] = useState(false)
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false)
  const [linkedLibraryIds, setLinkedLibraryIds] = useState([])
  const [deletingId, setDeletingId] = useState(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewErr, setReviewErr] = useState(null)
  const [review, setReview] = useState(null)
  const [reviewScore, setReviewScore] = useState('')
  const [reviewFeedback, setReviewFeedback] = useState('')
  const [reviewSaving, setReviewSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiMeta, setAiMeta] = useState(null)
  const [groups, setGroups] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const billingQ = useBillingStatus()
  const billing = billingQ.data || null
  const plansQ = useSubscriptionPlans()
  const plans = Array.isArray(plansQ.data) ? plansQ.data : []
  const blocked = isInstructorBillingBlocked(billing)
  const homeworksLimitReached = isHomeworksMonthlyLimitReached(billing)
  const createBlocked = blocked || homeworksLimitReached
  const blockMessage = billing?.messages?.banner || basicTrialExpiredMessage(plans)

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
      setErr(e?.message || t('tasks.loadFailed'))
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [t])

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

  const resetForm = () => {
    setEditingId(null)
    setLinkedLibraryIds([])
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
  }

  const openCreate = () => {
    if (blocked) {
      toast(blockMessage, 'error')
      return
    }
    if (homeworksLimitReached) {
      toast(HOMEWORK_MONTHLY_LIMIT_MESSAGE, 'error')
      return
    }
    resetForm()
    setOpen(true)
  }

  const openEdit = (task) => {
    if (blocked) {
      toast(blockMessage, 'error')
      return
    }
    setEditingId(task.id)
    setLinkedLibraryIds([])
    setForm({
      title: task.title || '',
      topic: task.topic || '',
      question_file_url: task.question_file_url || '',
      description: task.description || '',
      due_date: task.due_date ? String(task.due_date).slice(0, 10) : '',
      max_score: task.max_score != null ? String(task.max_score) : '',
      group_id: task.group_id || '',
      selectedStudentIds: [],
    })
    setOpen(true)
  }

  const submit = async () => {
    if (blocked) {
      toast(blockMessage, 'error')
      return
    }
    if (!editingId && homeworksLimitReached) {
      toast(HOMEWORK_MONTHLY_LIMIT_MESSAGE, 'error')
      return
    }
    const title = String(form.title || '').trim()
    if (!title) {
      toast(t('tasks.toasts.titleRequired'), 'error')
      return
    }
    setSaving(true)
    try {
      const linkLibraryMaterials = async (assignmentId) => {
        if (!assignmentId || !linkedLibraryIds.length) return
        await Promise.all(
          linkedLibraryIds.map((id) =>
            api.post(`/materials/${id}/link`, { target_type: 'assignment', target_id: assignmentId }).catch(() => null),
          ),
        )
      }

      if (editingId) {
        await api.patch('/tasks/' + encodeURIComponent(editingId), {
          title,
          topic: form.topic || null,
          question_file_url: form.question_file_url || null,
          description: form.description || null,
          due_date: form.due_date || null,
          max_score: form.max_score ? Number(form.max_score) : null,
        })
        await linkLibraryMaterials(editingId)
        toast(t('tasks.toasts.updated'), 'success')
      } else {
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
        const assignmentId = d?.task?.id || d?.assignment?.id || d?.id
        await linkLibraryMaterials(assignmentId)
        toast(
          d.assignedCount
            ? t('tasks.toasts.sent', { count: d.assignedCount })
            : t('tasks.toasts.created'),
          'success',
        )
      }
      setOpen(false)
      resetForm()
      await load()
      queryClient.invalidateQueries({ queryKey: BILLING_STATUS_QUERY_KEY })
    } catch (e) {
      toast(e?.message || t('tasks.toasts.error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const uploadQuestionFile = async (file) => {
    if (blocked) {
      toast(blockMessage, 'error')
      return
    }
    if (!file) return
    setFileUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await api.post('/tasks/instructor/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      if (r?.url) {
        setForm((p) => ({ ...p, question_file_url: r.url }))
        toast(t('tasks.toasts.fileUploaded'), 'success')
        queryClient.invalidateQueries({ queryKey: BILLING_STATUS_QUERY_KEY })
      }
    } catch (e) {
      toast(e?.message || t('tasks.toasts.fileUploadFailed'), 'error')
    } finally {
      setFileUploading(false)
    }
  }

  const closeTaskModal = () => {
    if (saving || fileUploading) return
    setOpen(false)
    resetForm()
  }

  const focusFieldNearest = (e) => {
    const t = e.target
    if (!t?.matches?.('input, textarea, select')) return
    requestAnimationFrame(() => {
      try {
        t.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      } catch {
        /* ignore */
      }
    })
  }

  const removeTask = async (id, title) => {
    if (blocked) {
      toast(blockMessage, 'error')
      return
    }
    if (!window.confirm(t('tasks.deleteConfirm', { title }))) return
    setDeletingId(id)
    try {
      await api.delete('/tasks/' + encodeURIComponent(id))
      toast(t('tasks.toasts.deleted'), 'success')
      await load()
    } catch (e) {
      toast(e?.message || t('tasks.toasts.error'), 'error')
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
    setReviewLoading(true)
    setReviewErr(null)
    setReview(null)
    setReviewScore('')
    setReviewFeedback('')
    setAiMeta(null)
    try {
      const d = await api.get('/tasks/instructor/review/' + encodeURIComponent(studentAssignmentId))
      const r = d.review || null
      setReview(r)
      setReviewScore(r?.score != null ? String(r.score) : '')
      setReviewFeedback(r?.feedback || '')
      setAiMeta(r?.ai_metadata && typeof r.ai_metadata === 'object' ? r.ai_metadata : null)
    } catch (e) {
      setReviewErr(e?.message || t('tasks.loadFailed'))
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
      toast(t('tasks.toasts.reviewSaved'), 'success')
      await load()
      await loadAnalytics()
    } catch (e) {
      toast(e?.message || t('tasks.toasts.error'), 'error')
    } finally {
      setReviewSaving(false)
    }
  }

  const runAiSuggest = async () => {
    if (!review?.student_assignment_id) return
    setAiLoading(true)
    try {
      const d = await api.post(
        '/tasks/instructor/review/' + encodeURIComponent(review.student_assignment_id) + '/ai-suggest',
      )
      const ai = d.ai || null
      setAiMeta(ai)
      setReview((prev) => (prev ? { ...prev, ai_metadata: ai } : prev))
      toast(t('tasks.toasts.aiReady'), 'success')
    } catch (e) {
      if (e?.ai) setAiMeta(e.ai)
      toast(e?.message || t('tasks.toasts.aiError'), 'error')
    } finally {
      setAiLoading(false)
    }
  }

  const applyAiSuggestion = () => {
    if (!aiMeta || aiMeta.status !== 'ready') return
    if (aiMeta.suggested_score != null) setReviewScore(String(aiMeta.suggested_score))
    if (aiMeta.draft_feedback) setReviewFeedback(aiMeta.draft_feedback)
    toast(t('tasks.toasts.aiApplied'), 'success')
  }

  const decideLate = async (decision) => {
    if (!review?.student_assignment_id) return
    setReviewSaving(true)
    try {
      const d = await api.patch('/tasks/instructor/review/' + encodeURIComponent(review.student_assignment_id), {
        late_decision: decision,
      })
      setReview(d.review || review)
      toast(decision === 'accepted' ? t('tasks.toasts.lateAccepted') : t('tasks.toasts.lateRejected'), 'success')
      await load()
    } catch (e) {
      toast(e?.message || t('tasks.toasts.error'), 'error')
    } finally {
      setReviewSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 w-full min-w-0 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain">{t('tasks.title')}</h1>
          <p className="text-token-textMuted text-sm mt-1">
            {t('tasks.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link
            to="/instructor/tasks/analytics"
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/10"
          >
            {t('tasks.analytics')}
          </Link>
          <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            {t('tasks.refresh')}
          </Button>
          <Button size="sm" disabled={createBlocked} onClick={openCreate}>
            {t('tasks.newTask')}
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
          <p className="text-xs text-token-textMuted">{t('tasks.stats.tasks')}</p>
          <p className="text-lg font-bold text-token-textMain mt-1">{tasks.length}</p>
        </Card>
        <Card hover className="p-4">
          <p className="text-xs text-token-textMuted">{t('tasks.stats.assignments')}</p>
          <p className="text-lg font-bold text-token-textMain mt-1">{stats.total}</p>
        </Card>
        <Card hover className="p-4">
          <p className="text-xs text-token-textMuted">{t('tasks.stats.submissionRate')}</p>
          <p className="text-lg font-bold text-token-textMain mt-1">
            {analytics?.submission_rate != null ? `${analytics.submission_rate}%` : '—'}
          </p>
        </Card>
        <Card hover className="p-4">
          <p className="text-xs text-token-textMuted">{t('tasks.stats.avgScore')}</p>
          <p className="text-lg font-bold text-token-textMain mt-1">
            {analytics?.average_score != null ? analytics.average_score : '—'}
          </p>
        </Card>
      </div>

      {loading ? (
        <Card hover className="p-5 text-sm text-token-textMuted">
          {t('tasks.loading')}
        </Card>
      ) : tasks.length === 0 ? (
        <Card hover className="p-5 text-sm text-token-textMuted">
          {t('tasks.empty')}
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const recipients = parseRecipients(task)
            return (
              <Card key={task.id} hover className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-token-textMain font-semibold break-words">{task.title}</p>
                    {task.topic ? (
                      <p className="text-sm text-token-textMuted mt-1 break-words">{t('tasks.card.topic', { topic: task.topic })}</p>
                    ) : null}
                    <p className="text-xs text-token-textMuted mt-1">
                      {t('tasks.card.created')} <span className="text-token-textMain font-mono">{fmtLocaleField(task, 'created_at', i18n.language)}</span>
                      {task.due_date ? (
                        <>
                          {' '}
                          · {t('tasks.card.dueDate')} <span className="text-token-textMain font-mono">{fmtDue(task.due_date, i18n.language)}</span>
                        </>
                      ) : null}
                      {task.group_name ? (
                        <>
                          {' '}
                          · {t('tasks.card.group')} <span className="text-token-textMain">{task.group_name}</span>
                        </>
                      ) : null}
                      {task.max_score ? (
                        <>
                          {' '}
                          · {t('tasks.card.maxScore')} <span className="text-token-textMain">{task.max_score}</span>
                        </>
                      ) : null}
                      <span className="block sm:inline sm:ml-1 mt-0.5 sm:mt-0">
                        {t('tasks.card.assignments', { assigned: task.assigned_count || 0, submitted: task.submitted_count || 0, pending: task.pending_count || 0 })}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const title = task.title || t('tasks.defaultTitle')
                        const qs = new URLSearchParams({
                          assignmentId: task.id,
                          assignmentTitle: title,
                        })
                        navigate(`/instructor/assignment-chat?${qs.toString()}`)
                      }}
                    >
                      {t('tasks.chat')}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await copyStudentTaskLink(task.id)
                          toast(t('tasks.toasts.linkCopied'), 'success')
                        } catch {
                          toast(t('tasks.toasts.linkCopyFailed'), 'error')
                        }
                      }}
                    >
                      {t('tasks.link')}
                    </Button>
                    <Button size="sm" variant="secondary" disabled={blocked} onClick={() => openEdit(task)}>
                      {t('tasks.edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={blocked}
                      loading={deletingId === task.id}
                      onClick={() => void removeTask(task.id, task.title)}
                    >
                      {t('tasks.delete')}
                    </Button>
                  </div>
                </div>
                {task.description ? (
                  <div className="mt-3 text-sm text-token-textMain whitespace-pre-wrap leading-relaxed border-t border-[color:var(--border-subtle)] pt-3">
                    <span className="text-xs font-semibold text-token-textMuted uppercase tracking-wider">{t('tasks.card.teacherNote')}</span>
                    <div className="mt-1">{task.description}</div>
                  </div>
                ) : null}
                {recipients.length > 0 ? (
                  <div className="mt-3 rounded-xl border border-indigo-500/15 bg-[#0f0c29]/50 p-3">
                    <p className="text-[10px] font-semibold text-token-textMuted uppercase tracking-wider mb-2">{t('tasks.card.studentsStatus')}</p>
                    <ul className="space-y-1.5">
                      {recipients.map((r) => (
                        <li key={r.student_id} className="flex items-center justify-between gap-2 text-sm min-w-0">
                          <span className="text-token-textMain truncate">{r.full_name || t('tasks.defaultStudent')}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${assignmentStatusClass(r.status)}`}
                            >
                              {taskStatusLabel(r.status)}
                            </span>
                            {['submitted', 'late', 'reviewed', 'completed'].includes(r.status) ? (
                              <Button size="sm" variant="secondary" onClick={() => void openReview(r.student_assignment_id)}>
                                {t('tasks.review')}
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

      <Modal
        open={open}
        onClose={closeTaskModal}
        title={editingId ? t('tasks.modal.editTitle') : t('tasks.modal.createTitle')}
        size="lg"
        scrollBody
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={closeTaskModal} disabled={saving || fileUploading}>
              {t('tasks.cancel')}
            </Button>
            <Button onClick={() => void submit()} loading={saving} disabled={createBlocked || fileUploading}>
              {editingId ? t('tasks.save') : t('tasks.send')}
            </Button>
          </div>
        }
      >
        <div
          className="space-y-4 min-h-[min(52vh,28rem)] [overflow-anchor:none]"
          onFocusCapture={focusFieldNearest}
        >
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('tasks.form.title')}</label>
            <input
              className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder={t('tasks.form.titlePh')}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('tasks.form.topic')}</label>
            <input
              className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={form.topic}
              onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))}
              placeholder={t('tasks.form.topicPh')}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('tasks.form.description')}</label>
            <textarea
              rows={4}
              className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500 resize-none"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder={t('tasks.form.descriptionPh')}
            />
          </div>
          <div className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/40 p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('tasks.form.fileSection')}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLibraryPickerOpen(true)}
                  disabled={blocked}
                  className="text-xs font-semibold text-primary hover:text-primary/80"
                >
                  {t('tasks.library')}
                </button>
                <label className="text-xs font-semibold text-blue-400 hover:text-blue-300 cursor-pointer">
                  {t('tasks.upload')}
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xlsx,.xls,.ppt,.pptx,.csv,.zip,application/pdf,image/png,image/jpeg,application/zip"
                    onChange={(e) => void uploadQuestionFile(e.target.files?.[0])}
                    disabled={blocked || fileUploading}
                  />
                </label>
              </div>
            </div>
            <LibraryMaterialPickerModal
              open={libraryPickerOpen}
              onClose={() => setLibraryPickerOpen(false)}
              selectedIds={linkedLibraryIds}
              onSelect={(material) => {
                setLinkedLibraryIds((prev) => (prev.includes(material.id) ? prev : [...prev, material.id]))
                if (!form.question_file_url) {
                  setForm((p) => ({ ...p, question_file_url: material.file_url }))
                }
                toast(t('tasks.toasts.libraryAdded', { title: material.title }), 'success')
              }}
            />
            {linkedLibraryIds.length > 0 ? (
              <p className="text-[11px] text-primary/80 mb-2">{t('tasks.form.libraryLinked', { count: linkedLibraryIds.length })}</p>
            ) : null}
            {fileUploading ? (
              <p className="text-sm text-gray-500">{t('tasks.form.fileUploading')}</p>
            ) : form.question_file_url ? (
              <a
                className="text-sm text-blue-300 hover:text-blue-200 break-all"
                href={assignmentFileOpenUrl(form.question_file_url)}
                target="_blank"
                rel="noreferrer"
              >
                {assignmentFileLabel(form.question_file_url)}
              </a>
            ) : (
              <p className="text-sm text-gray-500">{t('tasks.form.noFile')}</p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('tasks.form.dueDate')}</label>
              <input
                type="date"
                className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                value={form.due_date}
                onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('tasks.form.maxScore')}</label>
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
          <div className="min-h-[13.5rem]">
            {editingId ? (
              <p className="text-xs text-amber-200/90 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
                {t('tasks.form.editLocked')}
              </p>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('tasks.form.group')}</label>
                  <select
                    className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                    value={form.group_id}
                    onChange={(e) => setForm((p) => ({ ...p, group_id: e.target.value }))}
                  >
                    <option value="">{t('tasks.form.groupPlaceholder')}</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.subject_name ? `${g.subject_name} · ` : ''}
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="border-t border-indigo-500/20 pt-3 mt-4">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    {t('tasks.form.crmStudents')}
                  </label>
                  <p className="text-xs text-gray-500 mb-2 leading-relaxed">
                    {t('tasks.form.crmHint')}
                  </p>
                  {studentsLoading ? (
                    <p className="text-sm text-gray-500">{t('tasks.form.studentsLoading')}</p>
                  ) : !students.length ? (
                    <p className="text-sm text-amber-200/90">{t('tasks.form.noCrmStudents')}</p>
                  ) : !students.filter((s) => (s.enrollment_status || 'active') === 'active').length ? (
                    <p className="text-sm text-amber-200/90">{t('tasks.form.noActiveStudents')}</p>
                  ) : (
                    <ul className="max-h-48 overflow-y-auto overscroll-contain space-y-2 rounded-xl border border-indigo-500/15 p-2 bg-[#0f0c29]/40">
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
              </>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={reviewOpen}
        onClose={() => {
          if (reviewLoading) return
          setReviewOpen(false)
        }}
        scrollBody
        title={review?.student_name ? t('tasks.review.titleWithName', { name: review.student_name }) : t('tasks.review.title')}
        size="xl"
      >
        {reviewLoading ? (
          <p className="text-sm text-gray-500">{t('tasks.loading')}</p>
        ) : reviewErr ? (
          <p className="text-sm text-amber-200/90">{reviewErr}</p>
        ) : review ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/50 p-3">
              <p className="text-sm text-white font-semibold break-words">{review.title}</p>
              {review.topic ? <p className="text-sm text-indigo-200/90 mt-1">{t('tasks.review.topic', { topic: review.topic })}</p> : null}
              {review.question_file_url ? (
                <p className="text-xs text-gray-500 mt-1">
                  {t('tasks.review.taskFile')}{' '}
                  <a
                    className="text-blue-300 hover:text-blue-200 font-semibold"
                    href={assignmentFileOpenUrl(review.question_file_url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {assignmentFileLabel(review.question_file_url)}
                  </a>
                </p>
              ) : null}
              <p className="text-xs text-gray-500 mt-1 font-mono tabular-nums">
                {review.submitted_at ? t('tasks.review.submitted', { date: fmtLocaleField(review, 'submitted_at', i18n.language) }) : t('tasks.review.notSubmitted')}
              </p>
            </div>

            <div className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/40 p-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('tasks.review.studentAnswer')}</p>
              {review.answer_text ? (
                <div
                  className="prose prose-invert max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: review.answer_text }}
                />
              ) : (
                <p className="text-sm text-gray-500">{t('tasks.review.noAnswer')}</p>
              )}
            </div>

            <div className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/40 p-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('tasks.review.files')}</p>
              {Array.isArray(review.attachment_urls) && review.attachment_urls.length ? (
                <ul className="space-y-2">
                  {review.attachment_urls.map((u) => (
                    <li key={u}>
                      <a
                        className="text-sm text-blue-300 hover:text-blue-200 break-all"
                        href={assignmentFileOpenUrl(u)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {assignmentFileLabel(u)}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">{t('tasks.review.noFiles')}</p>
              )}
            </div>

            {Array.isArray(review.attachment_urls) && review.attachment_urls.some(isPreviewable) && (
              <div className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/40 p-3">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('tasks.review.preview')}</p>
                <div className="space-y-4">
                  {review.attachment_urls
                    .filter((u) => isPreviewable(u))
                    .map((u) => (
                      <div key={`pv-${u}`} className="space-y-2">
                        <a
                          className="text-xs text-blue-300 break-all"
                          href={assignmentFileOpenUrl(u)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {assignmentFileLabel(u)}
                        </a>
                        {renderPreview(assignmentFileOpenUrl(u))}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {review.question_file_url && isAssignmentPreviewable(review.question_file_url) && (
              <div className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/40 p-3">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {t('tasks.review.taskFilePreview')}
                </p>
                <div className="mt-2">{renderPreview(assignmentFileOpenUrl(review.question_file_url))}</div>
              </div>
            )}

            {review.status === 'late' && !review.late_decision ? (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 flex flex-wrap gap-2">
                <p className="text-sm text-amber-100 w-full">{t('tasks.review.lateTitle')}</p>
                <Button size="sm" onClick={() => void decideLate('accepted')} loading={reviewSaving}>
                  {t('tasks.review.acceptLate')}
                </Button>
                <Button size="sm" variant="danger" onClick={() => void decideLate('rejected')} loading={reviewSaving}>
                  {t('tasks.review.rejectLate')}
                </Button>
              </div>
            ) : null}

            {review.submitted_at ? (
              <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold text-violet-300 uppercase tracking-wider">
                    {t('tasks.review.aiTitle')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => void runAiSuggest()} loading={aiLoading}>
                      {aiMeta?.status === 'ready' ? t('tasks.review.aiReanalyze') : t('tasks.review.aiSuggest')}
                    </Button>
                    {aiMeta?.status === 'ready' ? (
                      <Button size="sm" onClick={applyAiSuggestion}>
                        {t('tasks.review.aiApply')}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  {t('tasks.review.aiHint')}
                </p>
                {aiLoading || aiMeta?.status === 'pending' ? (
                  <p className="text-sm text-violet-200/90">{t('tasks.review.aiAnalyzing')}</p>
                ) : null}
                {aiMeta?.status === 'error' ? (
                  <p className="text-sm text-amber-200/90">{aiMeta.error || t('tasks.review.aiError')}</p>
                ) : null}
                {aiMeta?.status === 'ready' ? (
                  <div className="space-y-2 text-sm text-gray-200">
                    {aiMeta.suggested_score != null ? (
                      <p>
                        <span className="text-gray-500">{t('tasks.review.suggestedScore')}</span>{' '}
                        <span className="font-semibold text-white">
                          {aiMeta.suggested_score}
                          {review.max_score != null ? ` / ${review.max_score}` : ''}
                        </span>
                      </p>
                    ) : null}
                    {aiMeta.summary ? <p className="text-indigo-100/90">{aiMeta.summary}</p> : null}
                    {Array.isArray(aiMeta.strengths) && aiMeta.strengths.length ? (
                      <div>
                        <p className="text-[10px] font-semibold text-emerald-400/90 uppercase">{t('tasks.review.strengths')}</p>
                        <ul className="list-disc list-inside text-emerald-100/80 mt-1 space-y-0.5">
                          {aiMeta.strengths.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {Array.isArray(aiMeta.weaknesses) && aiMeta.weaknesses.length ? (
                      <div>
                        <p className="text-[10px] font-semibold text-amber-400/90 uppercase">{t('tasks.review.weaknesses')}</p>
                        <ul className="list-disc list-inside text-amber-100/80 mt-1 space-y-0.5">
                          {aiMeta.weaknesses.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {aiMeta.recommendations ? (
                      <div>
                        <p className="text-[10px] font-semibold text-violet-300/90 uppercase">{t('tasks.review.recommendations')}</p>
                        <p className="text-gray-300 mt-1 whitespace-pre-wrap">{aiMeta.recommendations}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/40 p-3 space-y-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('tasks.review.gradeTitle')}</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={review.max_score || undefined}
                  className="w-28 bg-[#13112e] border border-indigo-500/20 rounded-lg px-3 py-2 text-white text-sm"
                  value={reviewScore}
                  onChange={(e) => setReviewScore(e.target.value)}
                  placeholder={review.max_score ? t('tasks.review.scoreRange', { max: review.max_score }) : t('tasks.review.scorePlaceholder')}
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
                placeholder={t('tasks.review.feedbackPh')}
              />
              <Button onClick={() => void saveReview()} loading={reviewSaving}>
                {t('tasks.review.saveFeedback')}
              </Button>
            </div>

            <Button
              variant="secondary"
              className="w-full justify-center"
              onClick={() => setReviewOpen(false)}
            >
              {t('tasks.close')}
            </Button>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
