import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ExamForm, { deriveMatchingKey } from '../../components/instructor/ExamForm'
import CertificateExamFields from '../../components/instructor/CertificateExamFields'
import ListSkeleton from '../../components/common/ListSkeleton'
import { useToast } from '../../components/common/Toast'
import { localDatetimeInputToUtcIso, utcInstantToDatetimeLocalValue } from '../../lib/examDatetime'
import useUiStore from '../../hooks/useUi'
import { BILLING_STATUS_QUERY_KEY, useBillingStatus } from '../../hooks/useBillingStatus'
import { copyStudentExamLink, studentExamShareUrl } from '../../lib/examShare'
import { EXAM_MONTHLY_LIMIT_MESSAGE, isExamsMonthlyLimitReached } from '../../lib/subscriptionPlanGuards'

function fmtDateLocale(iso, locale) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(locale === 'ru' ? 'ru-RU' : 'az-AZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function initEditQuestion(q) {
  const type = String(q.question_type || '').trim()
  let opts = q.options
  if (typeof opts === 'string') {
    try {
      opts = JSON.parse(opts)
    } catch {
      opts = []
    }
  }
  if (!Array.isArray(opts)) opts = []
  const closedTexts = ['', '', '', '', '']
  if (type === 'closed') {
    for (let i = 0; i < 5; i++) {
      const o = opts[i]
      closedTexts[i] = typeof o === 'string' ? o : o && typeof o === 'object' ? String(o.text ?? '') : ''
    }
  }
  const multTexts = ['', '', '', '']
  if (type === 'multiple') {
    for (let i = 0; i < 4; i++) {
      const o = opts[i]
      multTexts[i] = typeof o === 'string' ? o : o && typeof o === 'object' ? String(o.text ?? '') : ''
    }
  }
  const matchRows =
    type === 'matching'
      ? opts.length
        ? opts.map((r) => ({
            left: r && typeof r === 'object' ? String(r.left ?? '') : '',
            right: r && typeof r === 'object' ? String(r.right ?? '') : '',
          }))
        : [
            { left: '', right: '' },
            { left: '', right: '' },
          ]
      : []
  const seqItems =
    type === 'sequence'
      ? opts.length
        ? opts.map((r) => (typeof r === 'string' ? r : r && typeof r === 'object' ? String(r.text ?? '') : '')).slice(0, 24)
        : ['', '', '']
      : []
  const base = {
    ...q,
    _closedTexts: closedTexts,
    _multTexts: multTexts,
    _matchRows: matchRows,
    _seqItems: seqItems,
  }
  if (type === 'matching') {
    const dk = deriveMatchingKey(matchRows)
    if (dk) return { ...base, correct_answer: dk }
  }
  return base
}

function serializeEditQuestion(eq) {
  const type = String(eq.question_type || '').trim()
  let options = []
  if (type === 'closed') {
    options = (eq._closedTexts || ['', '', '', '', '']).map((text, j) => ({
      key: String.fromCharCode(65 + j),
      text: String(text || '').trim(),
    }))
  } else if (type === 'multiple') {
    options = (eq._multTexts || ['', '', '', '']).map((text, j) => ({
      key: String(j + 1),
      text: String(text || '').trim(),
    }))
  } else if (type === 'matching') {
    options = (eq._matchRows || []).map((r) => ({
      left: String(r.left ?? '').trim(),
      right: String(r.right ?? '').trim(),
    }))
  } else if (type === 'sequence') {
    options = (eq._seqItems || []).map((text, j) => ({
      key: String(j + 1),
      text: String(text || '').trim(),
    }))
  } else {
    let o = eq.options
    if (typeof o === 'string') {
      try {
        o = JSON.parse(o)
      } catch {
        o = []
      }
    }
    options = Array.isArray(o) ? o : []
  }
  let correct = String(eq.correct_answer ?? '').trim()
  if (type === 'matching') {
    const dk = deriveMatchingKey(options)
    if (dk) correct = dk
  }
  if (type === 'multiple') {
    correct = correct
      .replace(/\D/g, '')
      .split('')
      .filter((c, i, a) => a.indexOf(c) === i)
      .sort()
      .join('')
  }
  if (type === 'sequence') {
    correct = correct.replace(/\D/g, '').slice(0, 120)
  }
  if (type === 'closed' && correct) correct = correct.toUpperCase().slice(0, 1)

  const base = {
    id: eq.id,
    question_text: String(eq.question_text ?? '').trim() || 'Sual',
    question_type: type,
    points: eq.points,
    options,
    template_hint: eq.template_hint,
    order_num: eq.order_num,
  }
  if (type === 'closed') base.negative_marking = eq.negative_marking
  else if (type === 'multiple') base.negative_marking = 0
  /** Boşdursa açarı göndərmə — PATCH köhnə `correct_answer`-ı saxlasın (təsadüfi silinməsin). */
  if (correct) base.correct_answer = correct
  return base
}

export default function InstructorExams() {
  const { t, i18n } = useTranslation()
  const [exams, setExams] = useState([])
  const [students, setStudents] = useState([])
  const [studentsLoading, setStudentsLoading] = useState(true)
  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [editExam, setEditExam] = useState(null)
  const [editMaterialFiles, setEditMaterialFiles] = useState([])
  const [editMaterialBusy, setEditMaterialBusy] = useState(false)
  const [editStudentIds, setEditStudentIds] = useState([])
  const [editBaselineAssigned, setEditBaselineAssigned] = useState(() => new Set())
  const [editAssignmentsLoading, setEditAssignmentsLoading] = useState(false)
  const [editQuestions, setEditQuestions] = useState([])
  const [editQuestionsLoading, setEditQuestionsLoading] = useState(false)
  const [certTemplates, setCertTemplates] = useState([])
  const [lateBusyStudentId, setLateBusyStudentId] = useState(null)
  const [lateAccessPreset, setLateAccessPreset] = useState('120')
  const [lateAccessCustomUntil, setLateAccessCustomUntil] = useState('')
  const [studentPickerQuery, setStudentPickerQuery] = useState('')
  const [showAllStudentsInPicker, setShowAllStudentsInPicker] = useState(false)
  const editMaterialsInputRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [examsLoading, setExamsLoading] = useState(true)
  const [examsError, setExamsError] = useState(null)
  const toast = useToast()
  const { theme } = useUiStore()
  const queryClient = useQueryClient()
  const billingQ = useBillingStatus()
  const billing = billingQ.data || null
  const blocked = Boolean(billing?.should_block)
  const examsLimitReached = isExamsMonthlyLimitReached(billing)
  const createBlocked = blocked || examsLimitReached

  const loadExams = async () => {
    setExamsError(null)
    setExamsLoading(true)
    try {
      const d = await api.get('/exams')
      setExams(d.exams || [])
    } catch (err) {
      setExamsError(err?.message || t('exams.loadFailed'))
      setExams([])
    } finally {
      setExamsLoading(false)
    }
  }

  useEffect(() => {
    void loadExams()
    setStudentsLoading(true)
    api
      .get('/students')
      .then((d) => setStudents(d.students || []))
      .catch(() => setStudents([]))
      .finally(() => setStudentsLoading(false))
    api
      .get('/certificates/instructor/templates')
      .then((r) => setCertTemplates(Array.isArray(r?.templates) ? r.templates : []))
      .catch(() => setCertTemplates([]))
  }, [])
 
  const statusBadge = (e) => {
    const now = new Date()
    const fromRaw = e?.available_from || e?.start_time
    const untilRaw = e?.available_until
    const from = fromRaw ? new Date(fromRaw) : null
    const until = untilRaw ? new Date(untilRaw) : null
    const okFrom = from && !Number.isNaN(from.getTime()) ? from : null
    const okUntil = until && !Number.isNaN(until.getTime()) ? until : null
    if (!okFrom || !okUntil) return { label: t('exams.status.noTime'), cls: 'bg-amber-500/15 text-amber-300' }
    if (now > okUntil) return { label: t('exams.status.closed'), cls: 'bg-gray-500/20 text-gray-400' }
    if (now >= okFrom) return { label: t('exams.status.active'), cls: 'bg-emerald-500/20 text-emerald-400' }
    return { label: t('exams.status.pending'), cls: 'bg-blue-500/20 text-blue-400' }
  }
 
  const normalizeExamFiles = (exam) => {
    let raw = exam?.exam_files
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw)
      } catch {
        raw = []
      }
    }
    const arr = Array.isArray(raw) ? raw : []
    const mapped = arr
      .filter((x) => x && typeof x === 'object' && x.url)
      .map((x, i) => ({
        id: `${x.url}-${i}`,
        name: x.name || t('exams.fileDefault', { num: i + 1 }),
        url: x.url,
      }))
    if (mapped.length === 0 && exam?.pdf_url) {
      return [{ id: `${exam.pdf_url}-0`, name: t('exams.pdf'), url: exam.pdf_url }]
    }
    return mapped
  }

  const openEdit = async (exam) => {
    setEditModal(true)
    setEditExam({
      ...exam,
      certificate_enabled: !!exam.certificate_enabled,
      certificate_pass_pct: exam.certificate_pass_pct ?? 70,
      certificate_template_id: exam.certificate_template_id || null,
      is_public: !!exam.is_public,
      category_id: exam.category_id || null,
      level: exam.level || 'beginner',
      certificate_type: exam.certificate_type || 'professional',
      available_from: utcInstantToDatetimeLocalValue(exam.available_from || exam.start_time),
      available_until: utcInstantToDatetimeLocalValue(exam.available_until),
      // keep for legacy UI pieces
      start_time: utcInstantToDatetimeLocalValue(exam.available_from || exam.start_time),
    })
    setLateAccessPreset('120')
    setLateAccessCustomUntil('')
    setEditMaterialFiles(normalizeExamFiles(exam))
    setEditStudentIds([])
    setEditBaselineAssigned(new Set())
    setStudentPickerQuery('')
    setShowAllStudentsInPicker(false)
    setEditQuestions([])
    setEditAssignmentsLoading(true)
    setEditQuestionsLoading(true)
    try {
      const [dAssign, dQs] = await Promise.all([
        api.get(`/exams/${exam.id}/assignments`),
        api.get(`/exams/${exam.id}/questions`),
      ])
      const ids = Array.isArray(dAssign.student_ids) ? dAssign.student_ids : []
      setEditStudentIds(ids)
      setEditBaselineAssigned(new Set(ids.map(String)))
      const qs = Array.isArray(dQs?.questions) ? dQs.questions : []
      setEditQuestions(qs.map(initEditQuestion))
    } catch {
      setEditStudentIds([])
      setEditBaselineAssigned(new Set())
      setEditQuestions([])
    } finally {
      setEditAssignmentsLoading(false)
      setEditQuestionsLoading(false)
    }
  }
 
  const saveEdit = async () => {
    setLoading(true)
    try {
      const exam_files = editMaterialFiles.map(({ name, url }) => ({ name, url }))
      const payload = {
        title: editExam.title,
        subject: editExam.subject,
        topic: editExam.topic,
        allow_finish_after_until: editExam.allow_finish_after_until !== false,
        start_time: localDatetimeInputToUtcIso(editExam.available_from || editExam.start_time),
        available_from: localDatetimeInputToUtcIso(editExam.available_from || editExam.start_time),
        available_until: localDatetimeInputToUtcIso(editExam.available_until),
        duration_minutes: editExam.duration_minutes,
        notify_students: editExam.notify_students,
        show_results: editExam.show_results,
        wrong_penalty_enabled: editExam.wrong_penalty_enabled !== false,
        pdf_url: exam_files[0]?.url || null,
        exam_files,
        student_ids: editStudentIds,
        certificate_enabled: !!editExam.certificate_enabled,
        certificate_pass_pct: editExam.certificate_pass_pct ?? 70,
        certificate_template_id: editExam.certificate_template_id || null,
        is_public: !!editExam.is_public && !!editExam.certificate_enabled,
        category_id: editExam.is_public && editExam.certificate_enabled ? editExam.category_id || null : null,
        level: editExam.level || 'beginner',
        certificate_type: editExam.certificate_type || 'professional',
      }
      if (editQuestions.length) {
        payload.questions = editQuestions.map(serializeEditQuestion)
      }
      await api.patch('/exams/' + editExam.id, payload)
      toast(t('exams.toasts.updated'))
      setEditModal(false)
      loadExams()
    } catch (err) {
      toast(err.message || t('exams.toasts.error'), 'error')
    } finally { setLoading(false) }
  }

  const grantLateAccess = async (studentId) => {
    if (!editExam?.id || !studentId) return
    setLateBusyStudentId(String(studentId))
    try {
      const preset = String(lateAccessPreset || '120')
      const payload =
        preset === 'custom'
          ? { until: localDatetimeInputToUtcIso(lateAccessCustomUntil) }
          : { minutes: Number(preset) || 120 }
      await api.post(`/exams/${editExam.id}/late-access/${studentId}`, payload)
      toast(
        preset === 'custom'
          ? t('exams.toasts.lateAccessCustom')
          : t('exams.toasts.lateAccessMinutes', { minutes: payload.minutes }),
      )
    } catch (err) {
      toast(err?.message || t('exams.toasts.error'), 'error')
    } finally {
      setLateBusyStudentId(null)
    }
  }

  const deleteExam = async (exam) => {
    const ok = window.confirm(t('exams.deleteConfirm', { title: exam?.title || t('exams.defaultTitle') }))
    if (!ok) return
    setDeletingId(exam.id)
    try {
      await api.delete('/exams/' + exam.id)
      toast(t('exams.toasts.deleted'))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(exam.id)
        return next
      })
      await loadExams()
    } catch (err) {
      toast(err?.message || t('exams.toasts.deleteFailed'), 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const allIds = exams.map((e) => e?.id).filter(Boolean)
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))

  const toggleAll = (checked) => {
    setSelectedIds(() => (checked ? new Set(allIds) : new Set()))
  }

  const toggleOne = (id, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const bulkDelete = async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    const ok = window.confirm(t('exams.bulkDeleteConfirm', { count: ids.length }))
    if (!ok) return
    setBulkDeleting(true)
    try {
      await api.post('/exams/bulk-delete', { exam_ids: ids })
      toast(t('exams.toasts.bulkDeleted', { count: ids.length }))
      setSelectedIds(new Set())
      await loadExams()
    } catch (err) {
      toast(err?.message || t('exams.toasts.bulkDeleteFailed'), 'error')
    } finally {
      setBulkDeleting(false)
    }
  }
 
  const inp = 'w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500'

  const patchEditQuestion = (idx, partial) => {
    setEditQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...partial } : q)))
  }
  const setClosedOpt = (qIdx, optIdx, val) => {
    setEditQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q
        const next = [...(q._closedTexts || ['', '', '', '', ''])]
        next[optIdx] = val
        return { ...q, _closedTexts: next }
      })
    )
  }
  const setMultOpt = (qIdx, optIdx, val) => {
    setEditQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q
        const next = [...(q._multTexts || ['', '', '', ''])]
        next[optIdx] = val
        return { ...q, _multTexts: next }
      })
    )
  }
  const setMatchCell = (qIdx, rowIdx, side, val) => {
    setEditQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q
        const rows = [...(q._matchRows || [])]
        rows[rowIdx] = { ...rows[rowIdx], [side]: val }
        return { ...q, _matchRows: rows }
      })
    )
  }

  const removeEditMaterial = (id) => {
    setEditMaterialFiles((prev) => prev.filter((x) => x.id !== id))
  }

  const handleEditMaterialsChange = async (e) => {
    if (blocked) {
      toast(billing?.messages?.banner || t('exams.toasts.blocked'), 'error')
      e.target.value = ''
      return
    }
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setEditMaterialBusy(true)
    try {
      const results = await Promise.all(
        files.map(async (f) => {
          const fd = new FormData()
          fd.append('file', f)
          const data = await api.post('/exams/upload', fd)
          return {
            id: `${data.url}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: data.filename || f.name,
            url: data.url,
          }
        })
      )
      setEditMaterialFiles((prev) => [...prev, ...results])
      toast(t('exams.toasts.filesUploaded', { count: results.length }))
      queryClient.invalidateQueries({ queryKey: BILLING_STATUS_QUERY_KEY })
    } catch (err) {
      toast(err.message || t('exams.toasts.fileUploadFailed'), 'error')
    } finally {
      setEditMaterialBusy(false)
      e.target.value = ''
    }
  }

  const assignedIdSet = useMemo(() => new Set(editStudentIds.map(String)), [editStudentIds])
  const baselineAssignedSet = editBaselineAssigned

  const normDigits = (v) => String(v || '').replace(/\D/g, '')

  const pickerStudents = useMemo(() => {
    const q = studentPickerQuery.trim().toLowerCase()
    const qDigits = normDigits(q)
    const searching = Boolean(studentPickerQuery.trim())
    return (students || [])
      .filter((s) => s && s.id)
      // Default: hide already-assigned students to reduce noise.
      // While searching: include everyone so "Ad/telefon" search works for assigned students too.
      .filter((s) => searching || showAllStudentsInPicker || !baselineAssignedSet.has(String(s.id)))
      .filter((s) => {
        if (!q) return true
        const name = String(s.full_name || '').toLowerCase()
        const phone = String(s.phone || '').toLowerCase()
        if (name.includes(q) || phone.includes(q)) return true
        if (!qDigits) return false
        const phoneDigits = normDigits(phone)
        // allow searching "050..." against "+99450..." etc
        return (
          phoneDigits.includes(qDigits) ||
          (qDigits.length >= 7 && phoneDigits.endsWith(qDigits)) ||
          (qDigits.startsWith('0') && phoneDigits.endsWith(qDigits.slice(1)))
        )
      })
      .sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || ''), i18n.language === 'ru' ? 'ru' : 'az'))
  }, [students, studentPickerQuery, showAllStudentsInPicker, baselineAssignedSet])

  const toggleStudent = (id, checked) => {
    const sid = String(id)
    setEditStudentIds((prev) => {
      const set = new Set(prev.map(String))
      if (checked) set.add(sid)
      else set.delete(sid)
      return [...set]
    })
  }

  const eligibleNewInPicker = useMemo(
    () => pickerStudents.filter((s) => s?.id && !baselineAssignedSet.has(String(s.id))),
    [pickerStudents, baselineAssignedSet]
  )

  const toggleSelectAllPicker = (checked) => {
    setEditStudentIds((prev) => {
      const set = new Set(prev.map(String))
      const pickIds = eligibleNewInPicker.map((s) => String(s.id))
      if (checked) pickIds.forEach((id) => set.add(id))
      else pickIds.forEach((id) => set.delete(id))
      return [...set]
    })
  }

  const allPickerSelected =
    eligibleNewInPicker.length > 0 && eligibleNewInPicker.every((s) => assignedIdSet.has(String(s.id)))
 
  return (
    <div className="p-4 sm:p-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl">{t('exams.title')}</h1>
          <p className={['text-xs mt-1 max-w-xl', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')}>
            {t('exams.subtitle')}{' '}
            <Link to="/instructor/join-requests" className="text-primary hover:underline">
              {t('exams.joinRequestsLink')}
            </Link>
            {t('exams.subtitleRest')}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div
            className={[
              'flex items-center justify-between sm:justify-start gap-3 rounded-xl px-3 py-2 border',
              theme === 'dark'
                ? 'bg-[#13112e] border-indigo-500/20'
                : 'bg-token-surfaceMain border-[color:var(--border-subtle)]',
            ].join(' ')}
          >
            <label
              className={[
                'flex items-center gap-2 text-xs font-semibold select-none',
                theme === 'dark' ? 'text-gray-300' : 'text-token-textMain',
              ].join(' ')}
            >
              <input
                type="checkbox"
                className="w-4 h-4 accent-blue-500"
                checked={allSelected}
                onChange={(e) => toggleAll(e.target.checked)}
              />
              {t('exams.selectAll')}
            </label>
            <span className={['text-[11px]', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')}>
              {t('exams.selectedCount', { count: selectedIds.size })}
            </span>
          </div>
          <Button
            variant="secondary"
            onClick={bulkDelete}
            loading={bulkDeleting}
            disabled={selectedIds.size === 0}
            className={[
              'w-full sm:w-auto justify-center disabled:opacity-50',
              theme === 'dark'
                ? 'border-red-500/30 text-red-300 hover:text-red-200 hover:border-red-500/50'
                : '!border-slate-200 !text-slate-700 hover:!text-rose-700 hover:!border-rose-300 hover:bg-rose-500/10',
            ].join(' ')}
          >
            {t('exams.deleteSelected')}
          </Button>
          <Button
            disabled={createBlocked}
            onClick={() => {
              if (blocked) {
                toast(billing?.messages?.banner || t('exams.toasts.blocked'), 'error')
                return
              }
              if (examsLimitReached) {
                toast(EXAM_MONTHLY_LIMIT_MESSAGE, 'error')
                return
              }
              setAddModal(true)
            }}
            className="w-full sm:w-auto shrink-0 justify-center"
          >
            {t('exams.newExam')}
          </Button>
        </div>
      </div>
 
      <div className="space-y-4">
        {examsLoading && <ListSkeleton message={t('exams.loading')} />}
        {!examsLoading && examsError && (
          <Card className="p-6 text-center border border-amber-500/30 bg-amber-500/5">
            <p className="text-amber-200/90 text-sm mb-3">{examsError}</p>
            <p className="text-gray-500 text-xs mb-4">{t('exams.networkHint')}</p>
            <Button type="button" variant="secondary" onClick={() => void loadExams()}>
              {t('exams.reload')}
            </Button>
          </Card>
        )}
        {!examsLoading && !examsError &&
          exams.map((exam) => {
          const { label, cls } = statusBadge(exam)
          const checked = !!exam?.id && selectedIds.has(exam.id)
          return (
            <Card key={exam.id} className="p-4 sm:p-5 min-w-0 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 min-w-0">
                <div className="min-w-0 flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 w-4 h-4 accent-blue-500"
                    checked={checked}
                    onChange={(e) => toggleOne(exam.id, e.target.checked)}
                  />
                  <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                    <h3 className="font-display font-bold text-base sm:text-lg break-words">{exam.title}</h3>
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold shrink-0 ${cls}`}>{label}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
                    <span>
                      {fmtDateLocale(exam.available_from || exam.start_time, i18n.language)}
                      {exam.available_until ? ` → ${fmtDateLocale(exam.available_until, i18n.language)}` : ''}
                    </span>
                    <span>{t('exams.durationMin', { count: exam.duration_minutes })}</span>
                    <span>
                      {(Number(exam.crm_results_count) || 0) > 0 ||
                      (Number(exam.guest_results_count) || 0) > 0 ? (
                        <>
                          {t('exams.participantsPermanent', { count: Number(exam.crm_results_count) || 0 })} ·{' '}
                          {t('exams.participantsGuest', { count: Number(exam.guest_results_count) || 0 })}
                        </>
                      ) : (
                        <>{t('exams.participantsCount', { count: (exam.participant_count ?? exam.student_count) || 0 })}</>
                      )}
                    </span>
                    {Number(exam.results_count) > 0 ? (
                      <span>{t('exams.resultsCount', { count: exam.results_count })}</span>
                    ) : null}
                    {exam.avg_score != null && Number.isFinite(Number(exam.avg_score)) ? (
                      <span>{t('exams.avgScore', { score: exam.avg_score })}</span>
                    ) : null}
                    {exam.subject && <span>{exam.subject}</span>}
                    {exam.topic && <span>· {exam.topic}</span>}
                  </div>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap self-start sm:self-auto shrink-0">
                  {exam?.id && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          try {
                            await copyStudentExamLink(exam.id)
                            toast(t('exams.toasts.linkCopied'), 'success')
                          } catch {
                            toast(t('exams.toasts.linkCopyFailed'), 'error')
                          }
                        }}
                      >
                        {t('exams.link')}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          const link = studentExamShareUrl(exam.id)
                          try {
                            if (navigator.share) {
                              await navigator.share({
                                title: exam.title || t('exams.defaultTitle'),
                                text: t('exams.shareTitle'),
                                url: link,
                              })
                              return
                            }
                          } catch {
                            /* fallback */
                          }
                          try {
                            await copyStudentExamLink(exam.id)
                            toast(t('exams.toasts.shareLinkCopied'), 'success')
                          } catch {
                            toast(t('exams.toasts.shareFailed'), 'error')
                          }
                        }}
                      >
                        {t('exams.share')}
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => openEdit(exam)}>
                    {t('exams.edit')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className={[
                      theme === 'dark'
                        ? 'border-red-500/30 text-red-300 hover:text-red-200 hover:border-red-500/50'
                        : '!border-slate-200 !text-slate-700 hover:!text-rose-700 hover:!border-rose-300 hover:bg-rose-500/10',
                    ].join(' ')}
                    loading={deletingId === exam.id}
                    onClick={() => deleteExam(exam)}
                  >
                    {t('exams.delete')}
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
        {!examsLoading && !examsError && !exams.length && (
          <div className="text-center py-16 text-gray-500">{t('exams.empty')}</div>
        )}
      </div>
 
      <Modal open={addModal} onClose={() => setAddModal(false)} title={t('exams.modal.createTitle')} size="lg">
        <ExamForm
          students={students}
          studentsLoading={studentsLoading}
          blocked={createBlocked}
          blockMessage={
            examsLimitReached
              ? EXAM_MONTHLY_LIMIT_MESSAGE
              : billing?.messages?.banner || ''
          }
          onCreated={async (createdExam) => {
            setAddModal(false)
            loadExams()
            if (createdExam?.id) {
              try {
                const link = await copyStudentExamLink(createdExam.id)
                toast(t('exams.toasts.createdWithLink'), 'success')
              } catch {
                toast(t('exams.toasts.created'), 'success')
              }
            }
          }}
        />
      </Modal>
 
      {editExam && (
        <Modal open={editModal} onClose={() => setEditModal(false)} title={t('exams.modal.editTitle')} size="xl">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('exams.form.examName')}</label>
              <input className={inp} value={editExam.title}
                onChange={e => setEditExam(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('exams.form.subject')}</label>
                <input className={inp} placeholder={t('exams.form.subjectPh')} value={editExam.subject || ''}
                  onChange={e => setEditExam(p => ({ ...p, subject: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('exams.form.topic')}</label>
                <input className={inp} placeholder={t('exams.form.topicPh')} value={editExam.topic || ''}
                  onChange={e => setEditExam(p => ({ ...p, topic: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('exams.form.availableFrom')}</label>
                <input
                  type="datetime-local"
                  className={inp}
                  value={editExam.available_from || ''}
                  onChange={e => setEditExam(p => ({ ...p, available_from: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('exams.form.availableUntil')}</label>
                <input
                  type="datetime-local"
                  className={inp}
                  value={editExam.available_until || ''}
                  onChange={e => setEditExam(p => ({ ...p, available_until: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="edit_allow_finish_after_until"
                type="checkbox"
                className="w-4 h-4 accent-blue-500"
                checked={editExam.allow_finish_after_until !== false}
                onChange={(e) => setEditExam((p) => ({ ...p, allow_finish_after_until: e.target.checked }))}
              />
              <label htmlFor="edit_allow_finish_after_until" className="text-sm text-gray-300">
                {t('exams.form.allowFinishAfterUntil')}
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('exams.form.duration')}</label>
                <input
                  type="number"
                  min={1}
                  className={inp}
                  value={Number.isFinite(Number(editExam.duration_minutes)) ? editExam.duration_minutes : ''}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10)
                    setEditExam((p) => ({
                      ...p,
                      duration_minutes: Number.isFinite(v) ? v : p.duration_minutes,
                    }))
                  }}
                />
              </div>
              <div />
            </div>
            <div className="p-4 bg-[#13112e] rounded-xl border border-indigo-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{t('exams.form.notifySms')}</span>
                <input type="checkbox" checked={editExam.notify_students || false}
                  onChange={e => setEditExam(p => ({ ...p, notify_students: e.target.checked }))}
                  className="w-4 h-4 accent-blue-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{t('exams.form.showResults')}</span>
                <input type="checkbox" checked={editExam.show_results || false}
                  onChange={e => setEditExam(p => ({ ...p, show_results: e.target.checked }))}
                  className="w-4 h-4 accent-blue-500" />
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-sm font-semibold">{t('exams.form.wrongPenalty')}</span>
                  <p className="text-xs text-gray-500 mt-1 max-w-[min(100%,280px)]">
                    {t('exams.form.wrongPenaltyHint')}
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-blue-500 shrink-0 mt-1"
                  checked={editExam.wrong_penalty_enabled !== false}
                  onChange={(e) => setEditExam((p) => ({ ...p, wrong_penalty_enabled: e.target.checked }))}
                />
              </div>
            </div>

            <CertificateExamFields
              meta={editExam}
              setMeta={setEditExam}
              billingPlan={billing?.plan}
              templates={certTemplates}
            />

            <div className="p-4 bg-[#13112e] rounded-xl border border-indigo-500/20 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{t('exams.questions.title')}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {t('exams.questions.hint')}
                  </div>
                </div>
                <div className="text-xs text-gray-500 whitespace-nowrap">
                  {editQuestionsLoading ? t('exams.loadingShort') : t('exams.questions.count', { count: editQuestions.length })}
                </div>
              </div>
              {editQuestionsLoading ? (
                <p className="text-xs text-gray-500 py-2">{t('exams.questions.loading')}</p>
              ) : editQuestions.length === 0 ? (
                <p className="text-xs text-gray-500 py-2">{t('exams.questions.empty')}</p>
              ) : (
                <div className="space-y-3 max-h-[min(55vh,420px)] overflow-y-auto pr-1">
                  {editQuestions.map((q, idx) => {
                    const qType = String(q.question_type || '').trim()
                    return (
                      <div
                        key={q.id || idx}
                        className="rounded-lg border border-indigo-500/15 bg-[#0f0e24] p-3 space-y-2 text-left"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-indigo-300">
                            {t('exams.questions.number', { num: q.order_num ?? idx + 1 })} · {t(`exams.questionTypes.${qType}`, { defaultValue: qType })}
                          </span>
                          <label className="flex items-center gap-1.5 text-[11px] text-gray-400">
                            {t('exams.questions.points')}
                            <input
                              type="number"
                              min={0.01}
                              max={1000}
                              step="any"
                              className="min-w-[4.5rem] w-20 bg-[#13112e] border border-indigo-500/25 rounded-lg px-2 py-1 text-white text-xs text-center"
                              value={
                                q.points === '' || q.points == null || !Number.isFinite(Number(q.points))
                                  ? ''
                                  : q.points
                              }
                              onChange={(e) => {
                                const raw = e.target.value
                                if (raw === '') {
                                  patchEditQuestion(idx, { points: '' })
                                  return
                                }
                                const v = parseFloat(raw)
                                patchEditQuestion(idx, { points: Number.isFinite(v) ? v : q.points })
                              }}
                            />
                          </label>
                        </div>
                        <textarea
                          className={inp + ' resize-none'}
                          rows={2}
                          value={String(q.question_text ?? '')}
                          onChange={(e) => patchEditQuestion(idx, { question_text: e.target.value })}
                          placeholder={t('exams.questions.textPh')}
                        />
                        {qType === 'closed' && (
                          <label className="block text-[11px] text-gray-500">
                            {t('exams.questions.negativeMarking')}
                            <input
                              type="number"
                              step="0.01"
                              className={inp + ' mt-1'}
                              value={q.negative_marking != null ? String(q.negative_marking) : ''}
                              onChange={(e) => {
                                const n = Number(e.target.value)
                                patchEditQuestion(idx, {
                                  negative_marking: e.target.value === '' || Number.isNaN(n) ? 0 : n,
                                })
                              }}
                            />
                          </label>
                        )}
                        {qType === 'closed' && (
                          <div className="space-y-1.5">
                            <label className="text-[11px] text-gray-500">{t('exams.questions.correctClosed')}</label>
                            <select
                              className={inp + ' cursor-pointer'}
                              value={(() => {
                                const c = String(q.correct_answer ?? '')
                                  .toUpperCase()
                                  .replace(/[^A-E]/g, '')
                                  .slice(0, 1)
                                return ['A', 'B', 'C', 'D', 'E'].includes(c) ? c : ''
                              })()}
                              onChange={(e) =>
                                patchEditQuestion(idx, {
                                  correct_answer: e.target.value || '',
                                })
                              }
                            >
                              <option value="">{t('exams.questions.notSelected')}</option>
                              {['A', 'B', 'C', 'D', 'E'].map((letter) => (
                                <option key={letter} value={letter}>
                                  {letter}
                                </option>
                              ))}
                            </select>
                            <p className="text-[10px] text-gray-600 leading-snug">
                              {t('exams.questions.correctClosedHint')}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {(q._closedTexts || ['', '', '', '', '']).map((txt, oi) => (
                                <label key={oi} className="block text-[11px] text-gray-500">
                                  {t('exams.questions.option', { letter: String.fromCharCode(65 + oi) })}
                                  <input
                                    className={inp + ' mt-0.5'}
                                    value={txt}
                                    onChange={(e) => setClosedOpt(idx, oi, e.target.value)}
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        {qType === 'multiple' && (
                          <div className="space-y-1.5">
                            <label className="text-[11px] text-gray-500">{t('exams.questions.correctMultiple')}</label>
                            <input
                              className={inp}
                              value={String(q.correct_answer ?? '').replace(/\D/g, '')}
                              onChange={(e) =>
                                patchEditQuestion(idx, {
                                  correct_answer: e.target.value.replace(/\D/g, '').slice(0, 9),
                                })
                              }
                              placeholder="13"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              {(q._multTexts || ['', '', '', '']).map((txt, oi) => (
                                <label key={oi} className="block text-[11px] text-gray-500">
                                  {t('exams.questions.optionNum', { num: oi + 1 })}
                                  <input
                                    className={inp + ' mt-0.5'}
                                    value={txt}
                                    onChange={(e) => setMultOpt(idx, oi, e.target.value)}
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        {qType === 'matching' && (
                          <div className="space-y-2">
                            <label className="text-[11px] text-gray-500">{t('exams.questions.correctMatching')}</label>
                            <input
                              className={inp + ' font-mono text-xs'}
                              value={String(q.correct_answer ?? '')}
                              onChange={(e) =>
                                patchEditQuestion(idx, {
                                  correct_answer: e.target.value.toLowerCase().replace(/[^0-9a-z]/g, ''),
                                })
                              }
                              placeholder="1a2b3c"
                            />
                            {(q._matchRows || []).map((row, ri) => (
                              <div key={ri} className="grid grid-cols-2 gap-2">
                                <input
                                  className={inp}
                                  placeholder={t('exams.questions.left')}
                                  value={row.left}
                                  onChange={(e) => setMatchCell(idx, ri, 'left', e.target.value)}
                                />
                                <input
                                  className={inp}
                                  placeholder={t('exams.questions.right')}
                                  value={row.right}
                                  onChange={(e) => setMatchCell(idx, ri, 'right', e.target.value)}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                        {qType === 'sequence' && (
                          <div className="space-y-2">
                            <label className="text-[11px] text-gray-500">{t('exams.questions.seqItems')}</label>
                            <div className="space-y-2">
                              {(q._seqItems || []).map((txt, oi) => (
                                <label key={oi} className="block text-[11px] text-gray-500">
                                  {oi + 1}.
                                  <input
                                    className={inp + ' mt-0.5'}
                                    value={String(txt ?? '')}
                                    onChange={(e) => {
                                      const v = e.target.value
                                      patchEditQuestion(idx, {
                                        _seqItems: (q._seqItems || []).map((x, j) => (j === oi ? v : x)),
                                      })
                                    }}
                                  />
                                </label>
                              ))}
                            </div>
                            <button
                              type="button"
                              className="text-xs font-semibold text-indigo-300 hover:text-indigo-200"
                              onClick={() => patchEditQuestion(idx, { _seqItems: [...(q._seqItems || []), ''] })}
                            >
                              {t('exams.questions.addClause')}
                            </button>
                            <label className="block text-[11px] text-gray-500">
                              {t('exams.questions.correctSequence')}
                              <input
                                className={inp + ' mt-1 font-mono text-xs'}
                                value={String(q.correct_answer ?? '').replace(/\D/g, '')}
                                onChange={(e) =>
                                  patchEditQuestion(idx, {
                                    correct_answer: e.target.value.replace(/\D/g, '').slice(0, 120),
                                  })
                                }
                                placeholder="231"
                              />
                            </label>
                            <label className="block text-[11px] text-gray-500">
                              {t('exams.questions.templateHint')}
                              <input
                                className={inp + ' mt-1 font-mono text-xs'}
                                value={String(q.template_hint ?? '').replace(/\D/g, '')}
                                onChange={(e) =>
                                  patchEditQuestion(idx, {
                                    template_hint: e.target.value.replace(/\D/g, '').slice(0, 120),
                                  })
                                }
                                placeholder="231"
                              />
                            </label>
                          </div>
                        )}
                        {qType === 'open' && (
                          <div className="space-y-1.5">
                            <label className="text-[11px] text-gray-500">{t('exams.questions.openTemplate')}</label>
                            <input
                              className={inp}
                              value={String(q.template_hint ?? '')}
                              onChange={(e) => patchEditQuestion(idx, { template_hint: e.target.value })}
                              placeholder={t('exams.questions.openTemplatePh')}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="p-4 bg-[#13112e] rounded-xl border border-indigo-500/20 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{t('exams.materials.title')}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {t('exams.materials.hint')}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  loading={editMaterialBusy}
                  disabled={blocked}
                  onClick={() => editMaterialsInputRef.current?.click()}
                >
                  {t('exams.materials.update')}
                </Button>
              </div>
              <input
                ref={editMaterialsInputRef}
                type="file"
                multiple
                accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleEditMaterialsChange}
                disabled={blocked}
              />
              {editMaterialFiles.length === 0 ? (
                <div className="text-xs text-gray-500">{t('exams.materials.empty')}</div>
              ) : (
                <div className="space-y-2">
                  {editMaterialFiles.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-indigo-500/15 bg-[#0f0e24] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-white truncate">{f.name}</div>
                        <div className="text-[11px] text-gray-500 truncate">{f.url}</div>
                      </div>
                      <Button type="button" size="sm" variant="secondary" onClick={() => removeEditMaterial(f.id)}>
                        {t('exams.delete')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-[#13112e] rounded-xl border border-indigo-500/20 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{t('exams.students.title')}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {t('exams.students.hint')}
                  </div>
                </div>
                <div className="text-xs text-gray-500 whitespace-nowrap">
                  {editAssignmentsLoading ? t('exams.loadingShort') : t('exams.students.selectedCount', { count: editStudentIds.length })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    {t('exams.lateAccess.title')}
                  </label>
                  <select
                    className={inp}
                    value={lateAccessPreset}
                    onChange={(e) => setLateAccessPreset(e.target.value)}
                  >
                    <option value="30">{t('exams.lateAccess.min30')}</option>
                    <option value="60">{t('exams.lateAccess.min60')}</option>
                    <option value="120">{t('exams.lateAccess.min120')}</option>
                    <option value="custom">{t('exams.lateAccess.custom')}</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    {t('exams.lateAccess.customUntil')}
                  </label>
                  <input
                    type="datetime-local"
                    className={inp}
                    value={lateAccessCustomUntil}
                    onChange={(e) => setLateAccessCustomUntil(e.target.value)}
                    disabled={lateAccessPreset !== 'custom'}
                  />
                </div>
              </div>

              <input
                className={inp}
                placeholder={t('exams.students.searchPh')}
                value={studentPickerQuery}
                onChange={(e) => setStudentPickerQuery(e.target.value)}
              />

              <label className="flex items-center gap-2 text-xs font-semibold text-gray-300 select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-blue-500"
                  checked={showAllStudentsInPicker}
                  onChange={(e) => setShowAllStudentsInPicker(e.target.checked)}
                />
                {t('exams.students.showAll')}
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-gray-300 select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-blue-500"
                  checked={allPickerSelected}
                  onChange={(e) => toggleSelectAllPicker(e.target.checked)}
                />
                {t('exams.students.selectAllNew')}
              </label>

              <div className="max-h-56 overflow-auto rounded-lg border border-indigo-500/15">
                {pickerStudents.length === 0 ? (
                  <div className="p-3 text-xs text-gray-500">{t('exams.students.notFound')}</div>
                ) : (
                  pickerStudents.map((s) => {
                    const sid = String(s.id)
                    const checked = assignedIdSet.has(sid)
                    const wasAssigned = baselineAssignedSet.has(sid)
                    const untilRaw = editExam?.available_until
                    const until = untilRaw ? new Date(untilRaw) : null
                    const windowClosed = !!(until && !Number.isNaN(until.getTime()) && new Date() > until)
                    return (
                      <label
                        key={sid}
                        className="flex items-center justify-between gap-3 px-3 py-2 border-b border-indigo-500/10 last:border-b-0 cursor-pointer hover:bg-[#0f0e24]"
                      >
                        <div className="min-w-0">
                          <div className="text-sm text-token-textMain font-medium truncate">{s.full_name || t('exams.students.defaultName')}</div>
                          <div className="text-[11px] text-token-textMuted truncate">{s.phone || ''}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {wasAssigned ? (
                            <span className="text-[10px] text-gray-400">{t('exams.students.assigned')}</span>
                          ) : (
                            <span className="text-[10px] text-emerald-300">{t('exams.students.new')}</span>
                          )}
                          {wasAssigned && checked && windowClosed && (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              loading={lateBusyStudentId === sid}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                grantLateAccess(sid)
                              }}
                            >
                              {t('exams.students.grantLateAccess')}
                            </Button>
                          )}
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-blue-500"
                            checked={checked}
                            onChange={(e) => toggleStudent(sid, e.target.checked)}
                          />
                        </div>
                      </label>
                    )
                  })
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={saveEdit} loading={loading} className="flex-1 justify-center">{t('exams.save')}</Button>
              <Button variant="secondary" onClick={() => setEditModal(false)} className="flex-1 justify-center">{t('exams.cancel')}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
 
