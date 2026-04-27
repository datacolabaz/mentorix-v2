import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ExamForm from '../../components/instructor/ExamForm'
import ListSkeleton from '../../components/common/ListSkeleton'
import { useToast } from '../../components/common/Toast'
import { localDatetimeInputToUtcIso, utcInstantToDatetimeLocalValue } from '../../lib/examDatetime'
import useUiStore from '../../hooks/useUi'

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
  return {
    ...q,
    _closedTexts: closedTexts,
    _multTexts: multTexts,
    _matchRows: matchRows,
    _seqItems: seqItems,
  }
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
    negative_marking: eq.negative_marking,
    order_num: eq.order_num,
  }
  /** Boşdursa açarı göndərmə — PATCH köhnə `correct_answer`-ı saxlasın (təsadüfi silinməsin). */
  if (correct) base.correct_answer = correct
  return base
}

const EDIT_TYPE_AZ = {
  closed: 'Qapalı',
  multiple: 'Çoxseçimli',
  matching: 'Uyğunluq',
  sequence: 'Ardıcıllıq',
  open: 'Açıq',
}

export default function InstructorExams() {
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

  const loadExams = async () => {
    setExamsError(null)
    setExamsLoading(true)
    try {
      const d = await api.get('/exams')
      setExams(d.exams || [])
    } catch (err) {
      setExamsError(err?.message || 'İmtahanlar yüklənmədi')
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
  }, [])
 
  const statusBadge = (e) => {
    const now = new Date()
    const fromRaw = e?.available_from || e?.start_time
    const untilRaw = e?.available_until
    const from = fromRaw ? new Date(fromRaw) : null
    const until = untilRaw ? new Date(untilRaw) : null
    const okFrom = from && !Number.isNaN(from.getTime()) ? from : null
    const okUntil = until && !Number.isNaN(until.getTime()) ? until : null
    if (!okFrom || !okUntil) return { label: 'Vaxt yoxdur', cls: 'bg-amber-500/15 text-amber-300' }
    if (now > okUntil) return { label: 'Baglidir', cls: 'bg-gray-500/20 text-gray-400' }
    if (now >= okFrom) return { label: 'Aktiv', cls: 'bg-emerald-500/20 text-emerald-400' }
    return { label: 'Gozlenilir', cls: 'bg-blue-500/20 text-blue-400' }
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
        name: x.name || `Fayl ${i + 1}`,
        url: x.url,
      }))
    if (mapped.length === 0 && exam?.pdf_url) {
      return [{ id: `${exam.pdf_url}-0`, name: 'PDF', url: exam.pdf_url }]
    }
    return mapped
  }

  const openEdit = async (exam) => {
    setEditModal(true)
    setEditExam({
      ...exam,
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
      }
      if (editQuestions.length) {
        payload.questions = editQuestions.map(serializeEditQuestion)
      }
      await api.patch('/exams/' + editExam.id, payload)
      toast('Imtahan yenilendi!')
      setEditModal(false)
      loadExams()
    } catch (err) {
      toast(err.message || 'Xeta', 'error')
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
      toast(preset === 'custom' ? 'Giris icazesi verildi (custom)' : `Giris icazesi verildi (${payload.minutes} deq)`)
    } catch (err) {
      toast(err?.message || 'Xeta', 'error')
    } finally {
      setLateBusyStudentId(null)
    }
  }

  const deleteExam = async (exam) => {
    const ok = window.confirm(`"${exam?.title || 'İmtahan'}" silinsin? Bu əməliyyat geri qaytarılmır.`)
    if (!ok) return
    setDeletingId(exam.id)
    try {
      await api.delete('/exams/' + exam.id)
      toast('İmtahan silindi')
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(exam.id)
        return next
      })
      await loadExams()
    } catch (err) {
      toast(err?.message || 'Silinmədi', 'error')
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
    const ok = window.confirm(`${ids.length} imtahan birdən silinsin? Bu əməliyyat geri qaytarılmır.`)
    if (!ok) return
    setBulkDeleting(true)
    try {
      await api.post('/exams/bulk-delete', { exam_ids: ids })
      toast(`${ids.length} imtahan silindi`)
      setSelectedIds(new Set())
      await loadExams()
    } catch (err) {
      toast(err?.message || 'Toplu silinmədi', 'error')
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
      toast(`${results.length} fayl serverə yükləndi`)
    } catch (err) {
      toast(err.message || 'Fayl yüklənmədi (yalnız PDF, JPG, PNG)', 'error')
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
      .sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || ''), 'az'))
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
        <h1 className="font-display font-bold text-xl sm:text-2xl">Imtahanlar</h1>
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
              Hamısını seç
            </label>
            <span className={['text-[11px]', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')}>
              {selectedIds.size} seçildi
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
            Seçilənləri sil
          </Button>
          <Button onClick={() => setAddModal(true)} className="w-full sm:w-auto shrink-0 justify-center">
            + Yeni Imtahan
          </Button>
        </div>
      </div>
 
      <div className="space-y-4">
        {examsLoading && <ListSkeleton message="İmtahanlar yüklənir…" />}
        {!examsLoading && examsError && (
          <Card className="p-6 text-center border border-amber-500/30 bg-amber-500/5">
            <p className="text-amber-200/90 text-sm mb-3">{examsError}</p>
            <p className="text-gray-500 text-xs mb-4">Şəbəkə və ya server gecikməsi ola bilər.</p>
            <Button type="button" variant="secondary" onClick={() => void loadExams()}>
              Yenidən yüklə
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
                      {new Date(exam.available_from || exam.start_time).toLocaleString('az-AZ')}
                      {exam.available_until ? ` → ${new Date(exam.available_until).toLocaleString('az-AZ')}` : ''}
                    </span>
                    <span>{exam.duration_minutes} deq</span>
                    <span>{exam.student_count || 0} telebe</span>
                    {exam.subject && <span>{exam.subject}</span>}
                    {exam.topic && <span>· {exam.topic}</span>}
                  </div>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap self-start sm:self-auto shrink-0">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(exam)}>
                    Redakte
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
                    Sil
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
        {!examsLoading && !examsError && !exams.length && (
          <div className="text-center py-16 text-gray-500">Hele imtahan yoxdur</div>
        )}
      </div>
 
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Yeni Imtahan Yarat" size="lg">
        <ExamForm
          students={students}
          studentsLoading={studentsLoading}
          onCreated={() => {
            setAddModal(false)
            loadExams()
          }}
        />
      </Modal>
 
      {editExam && (
        <Modal open={editModal} onClose={() => setEditModal(false)} title="Imtahani Redakte Et" size="xl">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Imtahan Adi</label>
              <input className={inp} value={editExam.title}
                onChange={e => setEditExam(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Fenn</label>
                <input className={inp} placeholder="Riyaziyyat" value={editExam.subject || ''}
                  onChange={e => setEditExam(p => ({ ...p, subject: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Movzu</label>
                <input className={inp} placeholder="Inteqral" value={editExam.topic || ''}
                  onChange={e => setEditExam(p => ({ ...p, topic: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Aktivlik baslangici</label>
                <input
                  type="datetime-local"
                  className={inp}
                  value={editExam.available_from || ''}
                  onChange={e => setEditExam(p => ({ ...p, available_from: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Son giris vaxti</label>
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
                Son giriş vaxtı bitəndə yeni giriş bağlansın, amma daxil olan tələbə müddətini tamamlaya bilsin
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Muddet (deq)</label>
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
                <span className="text-sm font-semibold">SMS bildirisi</span>
                <input type="checkbox" checked={editExam.notify_students || false}
                  onChange={e => setEditExam(p => ({ ...p, notify_students: e.target.checked }))}
                  className="w-4 h-4 accent-blue-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Neticeni telebeye goster</span>
                <input type="checkbox" checked={editExam.show_results || false}
                  onChange={e => setEditExam(p => ({ ...p, show_results: e.target.checked }))}
                  className="w-4 h-4 accent-blue-500" />
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-sm font-semibold">Səhv düzü aparsın (0.25 cərimə)</span>
                  <p className="text-xs text-gray-500 mt-1 max-w-[min(100%,280px)]">
                    Qapalı və çoxseçimli suallar üçün cərimə. Söndürsəniz, bu imtahan üçün cərimə hesablanmır.
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

            <div className="p-4 bg-[#13112e] rounded-xl border border-indigo-500/20 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Suallar və ballar</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Sual mətni, bal, düzgün cavab və variantları düzəldə bilərsiniz (PDF-də səhv olanları buradan düzəltmək üçün).
                  </div>
                </div>
                <div className="text-xs text-gray-500 whitespace-nowrap">
                  {editQuestionsLoading ? 'Yüklənir…' : `${editQuestions.length} sual`}
                </div>
              </div>
              {editQuestionsLoading ? (
                <p className="text-xs text-gray-500 py-2">Suallar yüklənir…</p>
              ) : editQuestions.length === 0 ? (
                <p className="text-xs text-gray-500 py-2">Sual tapılmadı.</p>
              ) : (
                <div className="space-y-3 max-h-[min(55vh,420px)] overflow-y-auto pr-1">
                  {editQuestions.map((q, idx) => {
                    const t = String(q.question_type || '').trim()
                    return (
                      <div
                        key={q.id || idx}
                        className="rounded-lg border border-indigo-500/15 bg-[#0f0e24] p-3 space-y-2 text-left"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-indigo-300">
                            Sual {q.order_num ?? idx + 1} · {EDIT_TYPE_AZ[t] || t}
                          </span>
                          <label className="flex items-center gap-1.5 text-[11px] text-gray-400">
                            Bal
                            <input
                              type="number"
                              min={1}
                              max={1000}
                              className="w-16 bg-[#13112e] border border-indigo-500/25 rounded-lg px-2 py-1 text-white text-xs text-center"
                              value={Number.isFinite(Number(q.points)) ? q.points : ''}
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10)
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
                          placeholder="Sual mətni"
                        />
                        {(t === 'closed' || t === 'multiple') && (
                          <label className="block text-[11px] text-gray-500">
                            Mənfi bal (cərimə əmsalı, məs. -0.25)
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
                        {t === 'closed' && (
                          <div className="space-y-1.5">
                            <label className="text-[11px] text-gray-500">Düzgün cavab (A–E)</label>
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
                              <option value="">— Seçilməyib (dəyişməz / təyin et) —</option>
                              {['A', 'B', 'C', 'D', 'E'].map((letter) => (
                                <option key={letter} value={letter}>
                                  {letter}
                                </option>
                              ))}
                            </select>
                            <p className="text-[10px] text-gray-600 leading-snug">
                              Yalnız hərf seçəndə serverə düzgün cavab yazılır; boş saxlasanız əvvəlki dəyər silinmir.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {(q._closedTexts || ['', '', '', '', '']).map((txt, oi) => (
                                <label key={oi} className="block text-[11px] text-gray-500">
                                  Variant {String.fromCharCode(65 + oi)}
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
                        {t === 'multiple' && (
                          <div className="space-y-1.5">
                            <label className="text-[11px] text-gray-500">Düzgün variantlar (rəqəmlər, məs. 13)</label>
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
                                  Variant {oi + 1}
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
                        {t === 'matching' && (
                          <div className="space-y-2">
                            <label className="text-[11px] text-gray-500">Düzgün açar (məs. 1a2b3c)</label>
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
                                  placeholder="Sol"
                                  value={row.left}
                                  onChange={(e) => setMatchCell(idx, ri, 'left', e.target.value)}
                                />
                                <input
                                  className={inp}
                                  placeholder="Sağ"
                                  value={row.right}
                                  onChange={(e) => setMatchCell(idx, ri, 'right', e.target.value)}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                        {t === 'sequence' && (
                          <div className="space-y-2">
                            <label className="text-[11px] text-gray-500">Bəndlər (hər sətir bir bənd)</label>
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
                              + Bənd əlavə et
                            </button>
                            <label className="block text-[11px] text-gray-500">
                              Düzgün ardıcıllıq (bitişik rəqəmlər, məs. 231)
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
                              Tələbəyə nümunə (placeholder)
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
                        {t === 'open' && (
                          <div className="space-y-1.5">
                            <label className="text-[11px] text-gray-500">Şablon / gözlənti (avtomatik yoxlama üçün)</label>
                            <input
                              className={inp}
                              value={String(q.template_hint ?? '')}
                              onChange={(e) => patchEditQuestion(idx, { template_hint: e.target.value })}
                              placeholder="məs. 4.5"
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
                  <div className="text-sm font-semibold">Material fayllar</div>
                  <div className="text-xs text-gray-500 mt-1">
                    PDF/JPG/PNG əlavə edin və ya mövcud faylı silin. Yadda saxlayanda köhnə fayllar avtomatik silinəcək.
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  loading={editMaterialBusy}
                  onClick={() => editMaterialsInputRef.current?.click()}
                >
                  Faylı yenilə
                </Button>
              </div>
              <input
                ref={editMaterialsInputRef}
                type="file"
                multiple
                accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleEditMaterialsChange}
              />
              {editMaterialFiles.length === 0 ? (
                <div className="text-xs text-gray-500">Hələ material seçilməyib.</div>
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
                        Sil
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-[#13112e] rounded-xl border border-indigo-500/20 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Tələbələri seç</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Defolt olaraq yalnız bu imtahana hələ təyin olunmamış tələbələr göstərilir. Mövcud təyinləri
                    çıxarmaq üçün “Bütün tələbələri göstər”i açın.
                  </div>
                </div>
                <div className="text-xs text-gray-500 whitespace-nowrap">
                  {editAssignmentsLoading ? 'Yüklənir…' : `${editStudentIds.length} seçildi`}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Gecikən giriş icazəsi
                  </label>
                  <select
                    className={inp}
                    value={lateAccessPreset}
                    onChange={(e) => setLateAccessPreset(e.target.value)}
                  >
                    <option value="30">30 dəq</option>
                    <option value="60">60 dəq</option>
                    <option value="120">120 dəq</option>
                    <option value="custom">Custom (tarix-saat)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Custom bitmə vaxtı
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
                placeholder="Ad və ya telefon ilə axtar…"
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
                Bütün tələbələri göstər (mövcud təyinlər daxil)
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-gray-300 select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-blue-500"
                  checked={allPickerSelected}
                  onChange={(e) => toggleSelectAllPicker(e.target.checked)}
                />
                Hamısını seç (yeni təyinlər üçün)
              </label>

              <div className="max-h-56 overflow-auto rounded-lg border border-indigo-500/15">
                {pickerStudents.length === 0 ? (
                  <div className="p-3 text-xs text-gray-500">Tələbə tapılmadı.</div>
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
                          <div className="text-sm text-token-textMain font-medium truncate">{s.full_name || 'Telebe'}</div>
                          <div className="text-[11px] text-token-textMuted truncate">{s.phone || ''}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {wasAssigned ? (
                            <span className="text-[10px] text-gray-400">Təyin</span>
                          ) : (
                            <span className="text-[10px] text-emerald-300">Yeni</span>
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
                              Giris icazesi ver
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
              <Button onClick={saveEdit} loading={loading} className="flex-1 justify-center">Yadda Saxla</Button>
              <Button variant="secondary" onClick={() => setEditModal(false)} className="flex-1 justify-center">Legv et</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
 
