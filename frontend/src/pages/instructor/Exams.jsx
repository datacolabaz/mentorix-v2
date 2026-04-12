import { useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ExamForm from '../../components/instructor/ExamForm'
import ResultsTable from '../../components/exam/ResultsTable'

export default function InstructorExams() {
  const [exams, setExams] = useState([])
  const [students, setStudents] = useState([])
  const [addModal, setAddModal] = useState(false)
  const [resultsModal, setResultsModal] = useState(false)
  const [results, setResults] = useState([])
  const [selectedExam, setSelectedExam] = useState(null)

  const load = () => api.get('/exams').then(d => setExams(d.exams || []))

  useEffect(() => {
    load()
    api.get('/students').then(d => setStudents(d.students || []))
  }, [])

  const viewResults = async (exam) => {
    setSelectedExam(exam)
    const data = await api.get(`/exams/${exam.id}/results`)
    setResults(data.results || [])
    setResultsModal(true)
  }

  const statusBadge = (e) => {
    const now = new Date()
    const start = new Date(e.start_time)
    const end = new Date(start.getTime() + e.duration_minutes * 60000)
    if (now > end) return { label: 'Bitib', cls: 'bg-gray-500/20 text-gray-400' }
    if (now >= start) return { label: 'Aktiv', cls: 'bg-emerald-500/20 text-emerald-400' }
    return { label: 'Gozlenilir', cls: 'bg-blue-500/20 text-blue-400' }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl">Imtahanlar</h1>
        <Button onClick={() => setAddModal(true)}>+ Yeni Imtahan</Button>
      </div>
      <div className="space-y-4">
        {exams.map(exam => {
          const { label, cls } = statusBadge(exam)
          return (
            <Card key={exam.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-display font-bold text-lg">{exam.title}</h3>
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${cls}`}>{label}</span>
                  </div>
                  <div className="flex gap-4 text-sm text-gray-400">
                    <span>{new Date(exam.start_time).toLocaleString('az-AZ')}</span>
                    <span>{exam.duration_minutes} deq</span>
                    <span>{exam.student_count || 0} telebe</span>
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => viewResults(exam)}>Neticeler</Button>
              </div>
            </Card>
          )
        })}
        {!exams.length && <div className="text-center py-16 text-gray-500">Hele imtahan yoxdur</div>}
      </div>
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Yeni Imtahan Yarat" size="lg">
        <ExamForm students={students} onCreated={() => { setAddModal(false); load() }} />
      </Modal>
      <Modal open={resultsModal} onClose={() => setResultsModal(false)} title="Neticeler" size="xl">
        <ResultsTable results={results} examTitle={selectedExam?.title || 'imtahan'} />
      </Modal>
    </div>
  )
}

// Sun Apr 12 11:26:02 +04 2026
