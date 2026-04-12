import { useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Countdown from '../../components/exam/Countdown'
import { useToast } from '../../components/common/Toast'

/** API JSON: { key, text } və ya string; boş text olanda `opt.text || opt` obyekti render edirdi (React #31) */
function optionDisplayLabel(opt) {
  if (typeof opt === 'string') return opt || '—'
  if (opt && typeof opt === 'object') {
    const t = opt.text != null ? String(opt.text).trim() : ''
    if (t) return t
    if (opt.left != null || opt.right != null) {
      const pair = [opt.left, opt.right].filter((x) => x != null && String(x).trim() !== '').join(' → ')
      if (pair) return pair
    }
    if (opt.key != null) return String(opt.key)
  }
  return '—'
}

export default function StudentExams() {
  const [exams, setExams] = useState([])
  const [activeExam, setActiveExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [startedAt, setStartedAt] = useState(null)
  const [result, setResult] = useState(null)
  const toast = useToast()

  useEffect(() => {
    api.get('/exams/my').then(d => setExams(d.exams || []))
  }, [])

  const startExam = async (exam) => {
    try {
      const data = await api.get(`/exams/${exam.id}/questions`)
      setActiveExam(data.exam)
      setQuestions(data.questions)
      setAnswers({})
      setStartedAt(new Date().toISOString())
      setResult(null)
    } catch (err) {
      toast(err.message || 'Xəta', 'error')
    }
  }

  const submitExam = async () => {
    try {
      const data = await api.post('/exams/submit', {
        exam_id: activeExam.id,
        answers,
        started_at: startedAt,
      })
      setResult(data.score)
      setActiveExam(null)
      toast(`✓ İmtahan tamamlandı! Bal: ${data.score}%`)
      api.get('/exams/my').then(d => setExams(d.exams || []))
    } catch (err) {
      toast(err.message || 'Xəta', 'error')
    }
  }

  // Active exam UI
  if (activeExam) {
    const endTime = new Date(new Date(activeExam.start_time).getTime() + activeExam.duration_minutes * 60000)

    return (
      <div className="flex flex-col h-screen">
        {/* Header */}
        <div className="bg-[#13112e] border-b border-indigo-500/20 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div>
            <div className="font-display font-bold text-lg">{activeExam.title}</div>
            <div className="text-xs text-gray-400">{questions.length} sual</div>
          </div>
          <Countdown endTime={endTime} onExpire={submitExam} />
          <div className="text-right">
            <div className="text-sm text-gray-400">
              {Object.keys(answers).length}/{questions.length} cavablandı
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {questions.map((q, i) => (
            <Card key={q.id} className="p-6">
              <div className="flex gap-4 mb-4">
                <span className="bg-blue-500/20 text-blue-300 rounded-lg px-3 py-1 text-sm font-bold flex-shrink-0">{i + 1}</span>
                <p className="text-white font-medium leading-relaxed">{q.question_text ?? `Sual ${i + 1}`}</p>
                <span className="text-gray-500 text-xs ml-auto flex-shrink-0">{q.points} bal</span>
              </div>

              {q.question_type === 'closed' ? (
                <div className="space-y-2 ml-10">
                  {q.options?.map((opt, oi) => {
                    const key = String.fromCharCode(65 + oi)
                    const selected = answers[q.id] === key
                    return (
                      <button key={oi} onClick={() => setAnswers(p => ({ ...p, [q.id]: key }))}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${selected ? 'border-blue-500 bg-blue-500/15 text-white' : 'border-indigo-500/20 text-gray-300 hover:border-indigo-500/40'}`}>
                        <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${selected ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-600'}`}>
                          {key}
                        </span>
                        {optionDisplayLabel(opt)}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <textarea className="w-full ml-10 bg-[#13112e] border border-indigo-500/20 rounded-xl p-3 text-white text-sm resize-none outline-none focus:border-blue-500 transition-colors"
                  rows={4} placeholder="Cavabınızı yazın..."
                  value={answers[q.id] || ''}
                  onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))} />
              )}
            </Card>
          ))}
        </div>

        {/* Submit bar */}
        <div className="bg-[#13112e] border-t border-indigo-500/20 px-6 py-4 flex items-center justify-between">
          <span className="text-sm text-gray-400">{Object.keys(answers).length} cavablandı</span>
          <Button onClick={submitExam} className="px-8">İmtahanı Bitir →</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="font-display font-bold text-2xl mb-6">İmtahanlarım</h1>

      {result !== null && (
        <Card className="p-6 mb-6 text-center border-blue-500/40">
          <div className="text-5xl mb-3">{result >= 75 ? '🏆' : result >= 60 ? '🥈' : '📚'}</div>
          <div className="font-display font-extrabold text-4xl bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{result}%</div>
          <div className="text-gray-400 mt-2">Son imtahan nəticəniz</div>
        </Card>
      )}

      <div className="space-y-4">
        {exams.map(exam => {
          const now = new Date()
          const start = new Date(exam.start_time)
          const end = new Date(start.getTime() + exam.duration_minutes * 60000)
          const isActive = now >= start && now <= end
          const isDone = !!exam.submitted_at

          return (
            <Card key={exam.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display font-bold text-lg mb-2">{exam.title}</h3>
                  <div className="flex gap-4 text-sm text-gray-400">
                    <span>📅 {new Date(exam.start_time).toLocaleString('az-AZ')}</span>
                    <span>⏱ {exam.duration_minutes} dəq</span>
                  </div>
                  {isDone && (
                    <div className="mt-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-semibold inline-block">
                      ✓ Tamamlandı — {exam.score}%
                    </div>
                  )}
                </div>
                <div>
                  {isActive && !isDone ? (
                    <Button onClick={() => startExam(exam)}>🚀 Başla</Button>
                  ) : !isActive && now < start ? (
                    <span className="text-xs text-gray-500 bg-[#13112e] px-3 py-2 rounded-xl">⏳ Gözlənilir</span>
                  ) : (
                    <span className="text-xs text-gray-500 bg-[#13112e] px-3 py-2 rounded-xl">Bitib</span>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
        {!exams.length && (
          <div className="text-center py-16 text-gray-500">Sizin üçün imtahan yoxdur</div>
        )}
      </div>
    </div>
  )
}
