import { useCallback, useEffect, useRef, useState } from 'react'
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

/** Serverdən gələn /api/uploads/... üçün tam URL (VITE_API_URL=https://host/api) */
function resolveMaterialUrl(rel) {
  if (!rel || typeof rel !== 'string') return ''
  if (rel.startsWith('http')) return rel
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  const origin = base.replace(/\/api\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : '')
  const p = rel.startsWith('/') ? rel : `/${rel}`
  return origin ? `${origin}${p}` : p
}

/** exam_files JSONB / string + köhnə pdf_url — vahid siyahı */
function normalizeExamFiles(exam) {
  if (!exam) return []
  let raw = exam.exam_files
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      raw = []
    }
  }
  if (!Array.isArray(raw)) raw = []
  const list = raw
    .filter((x) => x && typeof x === 'object' && x.url)
    .map((x, i) => ({
      id: `${String(x.url)}-${i}`,
      name: x.name || `Fayl ${i + 1}`,
      url: x.url,
    }))
  const seen = new Set(list.map((x) => x.url))
  if (exam.pdf_url && typeof exam.pdf_url === 'string' && !seen.has(exam.pdf_url)) {
    return [{ id: exam.pdf_url, name: 'Material', url: exam.pdf_url }, ...list]
  }
  return list
}

function isMaterialImage(pathOrName) {
  const s = String(pathOrName || '')
  return /\.(jpe?g|png|gif|webp)$/i.test(s)
}

export default function StudentExams() {
  const [exams, setExams] = useState([])
  const [activeExam, setActiveExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [startedAt, setStartedAt] = useState(null)
  const [result, setResult] = useState(null)
  const [materialsOpen, setMaterialsOpen] = useState(true)
  const [, bumpListUi] = useState(0)
  const activeExamRef = useRef(false)
  activeExamRef.current = !!activeExam
  const toast = useToast()

  const loadExams = useCallback(() => api.get('/exams/my').then((d) => setExams(d.exams || [])), [])

  useEffect(() => {
    loadExams()
  }, [loadExams])

  // Gözləyərkən səhifə yeniləmədən "Başla" görünsün (vaxt keçəndə re-render)
  useEffect(() => {
    if (activeExam) return undefined
    const id = setInterval(() => bumpListUi((n) => n + 1), 5000)
    return () => clearInterval(id)
  }, [activeExam])

  // Siyahını serverdən ara-sıra yenilə (təyinat və s.)
  useEffect(() => {
    if (activeExam) return undefined
    const id = setInterval(loadExams, 45000)
    return () => clearInterval(id)
  }, [activeExam, loadExams])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && !activeExamRef.current) loadExams()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const startExam = async (exam) => {
    try {
      const data = await api.get(`/exams/${exam.id}/questions`)
      setActiveExam(data.exam)
      setQuestions(data.questions)
      setAnswers({})
      setStartedAt(new Date().toISOString())
      setResult(null)
      setMaterialsOpen(true)
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
    const materials = normalizeExamFiles(activeExam)

    return (
      <div className="flex flex-col h-screen min-h-0">
        {/* Header */}
        <div className="bg-[#13112e] border-b border-indigo-500/20 px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center gap-3 justify-between shrink-0 z-30">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="min-w-0">
              <div className="font-display font-bold text-lg truncate">{activeExam.title}</div>
              <div className="text-xs text-gray-400">{questions.length} sual</div>
            </div>
            {materials.length > 0 && (
              <button
                type="button"
                onClick={() => setMaterialsOpen((v) => !v)}
                className="lg:hidden shrink-0 text-xs font-semibold text-blue-400 border border-indigo-500/30 rounded-lg px-3 py-1.5 hover:bg-white/5"
              >
                {materialsOpen ? 'PDF gizlət' : 'PDF / şəkil'}
              </button>
            )}
          </div>
          <Countdown endTime={endTime} onExpire={submitExam} />
          <div className="text-right shrink-0">
            <div className="text-sm text-gray-400">
              {Object.keys(answers).length}/{questions.length} cavablandı
            </div>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 min-w-0 flex-col lg:flex-row">
          {materials.length > 0 && (
            <aside
              className={
                'shrink-0 bg-[#0f0c29]/80 flex flex-col min-h-0 min-w-0 border-indigo-500/20 transition-[max-height,width,opacity,padding] duration-300 ease-in-out ' +
                (materialsOpen
                  ? 'max-h-[42vh] lg:max-h-none w-full lg:w-[min(48%,560px)] lg:min-w-[280px] lg:max-w-[min(48%,560px)] border-b lg:border-b-0 lg:border-r opacity-100'
                  : 'max-h-0 lg:max-h-none w-full lg:w-0 lg:min-w-0 lg:max-w-0 border-0 opacity-0 overflow-hidden pointer-events-none lg:py-0')
              }
              aria-hidden={!materialsOpen}
            >
              <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2 shrink-0 border-b border-indigo-500/15">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider truncate">
                  Suallar (PDF / şəkil) — {materials.length} fayl
                </p>
                <button
                  type="button"
                  onClick={() => setMaterialsOpen(false)}
                  className="hidden lg:inline-flex shrink-0 text-xs font-semibold text-blue-400 hover:text-blue-300 px-2 py-1 rounded-lg border border-indigo-500/30 hover:bg-white/5"
                >
                  ← Gizlət
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-4">
                {materials.map((m) => {
                  const materialUrl = resolveMaterialUrl(m.url)
                  const img = isMaterialImage(m.url) || isMaterialImage(m.name)
                  return (
                    <div
                      key={m.id}
                      className="rounded-xl border border-indigo-500/20 overflow-hidden bg-black/20 flex flex-col"
                    >
                      <p className="text-xs text-gray-500 px-2 py-1.5 truncate border-b border-indigo-500/10" title={m.name}>
                        {m.name}
                      </p>
                      <div className="min-h-[200px] lg:min-h-[280px] max-h-[min(38vh,420px)] lg:max-h-[calc(100vh-220px)]">
                        {img ? (
                          <img
                            src={materialUrl}
                            alt={m.name}
                            className="w-full h-full max-h-[min(38vh,420px)] lg:max-h-[calc(100vh-240px)] object-contain object-top bg-black/30"
                          />
                        ) : (
                          <iframe
                            title={m.name}
                            src={materialUrl}
                            className="w-full h-full min-h-[200px] lg:min-h-[300px] bg-white/5 border-0"
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </aside>
          )}

          {materials.length > 0 && !materialsOpen && (
            <button
              type="button"
              aria-label="Materialları aç"
              onClick={() => setMaterialsOpen(true)}
              className="hidden lg:flex shrink-0 w-11 flex-col items-center justify-center gap-1 border-r border-indigo-500/20 bg-[#13112e] hover:bg-[#1a1740] text-blue-400 text-[11px] font-bold py-6 transition-colors"
            >
              <span className="text-base leading-none" aria-hidden>▶</span>
              <span className="[writing-mode:vertical-rl] rotate-180 uppercase tracking-widest">PDF</span>
            </button>
          )}

          <div className="flex-1 flex flex-col min-h-0 min-w-0">
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
          </div>
        </div>

        {/* Submit bar */}
        <div className="bg-[#13112e] border-t border-indigo-500/20 px-6 py-4 flex items-center justify-between shrink-0">
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
