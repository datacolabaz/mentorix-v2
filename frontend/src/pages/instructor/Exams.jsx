import { useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ExamForm from '../../components/instructor/ExamForm'
import ListSkeleton from '../../components/common/ListSkeleton'
import { useToast } from '../../components/common/Toast'
import { localDatetimeInputToUtcIso, utcInstantToDatetimeLocalValue } from '../../lib/examDatetime'

export default function InstructorExams() {
  const [exams, setExams] = useState([])
  const [students, setStudents] = useState([])
  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [editExam, setEditExam] = useState(null)
  const [loading, setLoading] = useState(false)
  const [examsLoading, setExamsLoading] = useState(true)
  const [examsError, setExamsError] = useState(null)
  const toast = useToast()

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
    api
      .get('/students')
      .then((d) => setStudents(d.students || []))
      .catch(() => setStudents([]))
  }, [])
 
  const statusBadge = (e) => {
    const now = new Date()
    const start = new Date(e.start_time)
    const end = new Date(start.getTime() + e.duration_minutes * 60000)
    if (now > end) return { label: 'Bitib', cls: 'bg-gray-500/20 text-gray-400' }
    if (now >= start) return { label: 'Aktiv', cls: 'bg-emerald-500/20 text-emerald-400' }
    return { label: 'Gozlenilir', cls: 'bg-blue-500/20 text-blue-400' }
  }
 
  const openEdit = (exam) => {
    setEditExam({ ...exam, start_time: utcInstantToDatetimeLocalValue(exam.start_time) })
    setEditModal(true)
  }
 
  const saveEdit = async () => {
    setLoading(true)
    try {
      await api.patch('/exams/' + editExam.id, {
        title: editExam.title,
        subject: editExam.subject,
        topic: editExam.topic,
        start_time: localDatetimeInputToUtcIso(editExam.start_time),
        duration_minutes: editExam.duration_minutes,
        notify_students: editExam.notify_students,
        show_results: editExam.show_results,
      })
      toast('Imtahan yenilendi!')
      setEditModal(false)
      loadExams()
    } catch (err) {
      toast(err.message || 'Xeta', 'error')
    } finally { setLoading(false) }
  }
 
  const inp = 'w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500'
 
  return (
    <div className="p-4 sm:p-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="font-display font-bold text-xl sm:text-2xl">Imtahanlar</h1>
        <Button onClick={() => setAddModal(true)} className="w-full sm:w-auto shrink-0 justify-center">+ Yeni Imtahan</Button>
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
          return (
            <Card key={exam.id} className="p-4 sm:p-5 min-w-0 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 min-w-0">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                    <h3 className="font-display font-bold text-base sm:text-lg break-words">{exam.title}</h3>
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold shrink-0 ${cls}`}>{label}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
                    <span>{new Date(exam.start_time).toLocaleString('az-AZ')}</span>
                    <span>{exam.duration_minutes} deq</span>
                    <span>{exam.student_count || 0} telebe</span>
                    {exam.subject && <span>{exam.subject}</span>}
                    {exam.topic && <span>· {exam.topic}</span>}
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => openEdit(exam)} className="self-start sm:self-auto shrink-0">Redakte</Button>
              </div>
            </Card>
          )
        })}
        {!examsLoading && !examsError && !exams.length && (
          <div className="text-center py-16 text-gray-500">Hele imtahan yoxdur</div>
        )}
      </div>
 
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Yeni Imtahan Yarat" size="lg">
        <ExamForm students={students} onCreated={() => { setAddModal(false); loadExams() }} />
      </Modal>
 
      {editExam && (
        <Modal open={editModal} onClose={() => setEditModal(false)} title="Imtahani Redakte Et" size="md">
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
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Baslama Vaxti</label>
                <input type="datetime-local" className={inp} value={editExam.start_time}
                  onChange={e => setEditExam(p => ({ ...p, start_time: e.target.value }))} />
              </div>
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
 
