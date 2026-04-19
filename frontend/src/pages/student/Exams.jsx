import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import Countdown from '../../components/exam/Countdown'
import { useToast } from '../../components/common/Toast'
import useUiStore from '../../hooks/useUi'
import useAuthStore from '../../hooks/useAuth'

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

function isMaterialPdf(pathOrName) {
  return /\.pdf(\?|#|$)/i.test(String(pathOrName || ''))
}

function questionTypeLabelAz(t) {
  const m = {
    closed: 'Qapalı',
    multiple: 'Çoxseçimli (şablon)',
    matching: 'Uyğunluq',
    open: 'Açıq',
  }
  return m[t] || t
}

function formatScoreBal(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  const rounded = Math.round(n * 100) / 100
  return `${rounded} bal`
}

/** Backend `examWindowOrLegacy` ilə eyni: until boşdursa from + duration */
function parseDateOrNull(v) {
  if (v == null || v === '') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

function parseExamWindow(exam) {
  const from = parseDateOrNull(exam?.available_from) || parseDateOrNull(exam?.start_time)
  const untilExplicit = parseDateOrNull(exam?.available_until)
  const until =
    untilExplicit ||
    (from ? new Date(from.getTime() + (Number(exam.duration_minutes) || 0) * 60000) : null)
  const allowFinish = exam?.allow_finish_after_until !== false
  return {
    from,
    until,
    allowFinish,
  }
}

function formatAzDateTime(d) {
  try {
    return d ? d.toLocaleString('az-AZ') : '—'
  } catch {
    return '—'
  }
}

export default function StudentExams() {
  const [exams, setExams] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState(null)
  const [activeExam, setActiveExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [startedAt, setStartedAt] = useState(null)
  const [result, setResult] = useState(null)
  const [resultBreakdown, setResultBreakdown] = useState(null)
  const [materialsOpen, setMaterialsOpen] = useState(true)
  const [, bumpListUi] = useState(0)
  const activeExamRef = useRef(false)
  activeExamRef.current = !!activeExam
  const toast = useToast()
  const { setFocusMode } = useUiStore()
  const { user } = useAuthStore()

  /** quiet: arxa plan yeniləməsində tam səhifə “yüklənir” göstərmə */
  const loadExams = useCallback((quiet = false) => {
    if (!quiet) setListLoading(true)
    return api
      .get('/exams/my')
      .then((d) => {
        setListError(null)
        const raw = d?.exams
        setExams(
          Array.isArray(raw) ? raw.filter((x) => x != null && x.id != null) : []
        )
      })
      .catch((err) => {
        if (!quiet) {
          setExams([])
          const msg = err?.message || 'İmtahanlar yüklənmədi'
          setListError(msg)
          toast(msg, 'error')
        }
      })
      .finally(() => {
        if (!quiet) setListLoading(false)
      })
  }, [])

  const [reviewModal, setReviewModal] = useState(null)
  const [leaderModal, setLeaderModal] = useState(null)

  useEffect(() => {
    loadExams(false)
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
    const id = setInterval(() => loadExams(true), 45000)
    return () => clearInterval(id)
  }, [activeExam, loadExams])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && !activeExamRef.current) loadExams(true)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [loadExams])

  const openPastReview = async (exam) => {
    setReviewModal({
      title: exam.title,
      loading: true,
      breakdown: null,
      score: null,
      submitted_at: null,
      error: null,
    })
    try {
      const d = await api.get(`/exams/${exam.id}/review`)
      setReviewModal({
        title: exam.title,
        loading: false,
        breakdown: Array.isArray(d.breakdown) ? d.breakdown : [],
        score: d.score,
        submitted_at: d.submitted_at,
        error: null,
      })
    } catch (err) {
      setReviewModal({
        title: exam.title,
        loading: false,
        breakdown: [],
        score: null,
        submitted_at: null,
        error: err?.message || 'Yüklənmədi',
      })
    }
  }

  const openLeaderboard = async (exam) => {
    setLeaderModal({ title: exam?.title || 'Reytinq', loading: true, error: null, grade: null, results: [] })
    try {
      const d = await api.get(`/exams/${exam.id}/results`)
      setLeaderModal({
        title: exam?.title || 'Reytinq',
        loading: false,
        error: null,
        grade: d.grade || null,
        results: Array.isArray(d.results) ? d.results : [],
      })
    } catch (err) {
      setLeaderModal({
        title: exam?.title || 'Reytinq',
        loading: false,
        error: err?.message || 'Yüklənmədi',
        grade: null,
        results: [],
      })
    }
  }

  const startExam = async (exam) => {
    try {
      const data = await api.get(`/exams/${exam.id}/questions`)
      setActiveExam(data.exam)
      // Defense-in-depth: tələbə payload-da correct_answer olsa belə UI-a buraxmırıq
      setQuestions(
        Array.isArray(data.questions)
          ? data.questions.map(({ correct_answer, ...rest }) => rest)
          : []
      )
      setAnswers({})
      setStartedAt(data?.started_at || new Date().toISOString())
      setResult(null)
      setResultBreakdown(null)
      setMaterialsOpen(true)
      setFocusMode(true)
    } catch (err) {
      toast(err.message || 'Xəta', 'error')
    }
  }

  const submitExam = async () => {
    try {
      const data = await api.post('/exams/submit', {
        exam_id: activeExam.id,
        answers,
      })
      setResult(data?.score ?? null)
      setResultBreakdown(Array.isArray(data?.breakdown) ? data.breakdown : null)
      setActiveExam(null)
      setFocusMode(false)
      toast(`✓ İmtahan tamamlandı! Bal: ${formatScoreBal(data?.score)}`)
      loadExams(true)
    } catch (err) {
      toast(err.message || 'Xəta', 'error')
    }
  }

  useEffect(() => {
    return () => setFocusMode(false)
  }, [setFocusMode])

  // Active exam UI
  if (activeExam) {
    const startActive = startedAt ? new Date(startedAt) : null
    const durActive = Number(activeExam.duration_minutes) || 0
    const endTime =
      startActive != null && !Number.isNaN(startActive.getTime())
        ? new Date(startActive.getTime() + durActive * 60000)
        : new Date(NaN)
    const materials = normalizeExamFiles(activeExam)
    const w = parseExamWindow(activeExam)

    return (
      <div className="flex flex-col h-screen min-h-0">
        {/* Header */}
        <div className="bg-[#13112e] border-b border-indigo-500/20 px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center gap-3 justify-between shrink-0 z-30">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="min-w-0">
              <div className="font-display font-bold text-lg truncate">{activeExam.title}</div>
              <div className="text-xs text-gray-400">{questions.length} sual</div>
              {w?.until && (
                <div className="text-[11px] text-gray-400 mt-1">
                  İmtahan {formatAzDateTime(w.until)}-a qədər aktivdir. Daxil olduğunuz andan etibarən {durActive} dəqiqə vaxtınız var. İnternetinizin sabit olduğundan əmin olun.
                </div>
              )}
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
                  // PDF iframe ilə; digər qəbul olunan fayllar (PNG/JPG) <img> — iframe PNG/JPEG göstərmir. Köhnə upload .bin uzantılı olsa belə şəkil kimi yoxlanır.
                  const showPdfFrame = isMaterialPdf(m.url) || isMaterialPdf(m.name)
                  return (
                    <div
                      key={m.id}
                      className="rounded-xl border border-indigo-500/20 overflow-hidden bg-black/20 flex flex-col"
                    >
                      <p className="text-xs text-gray-500 px-2 py-1.5 truncate border-b border-indigo-500/10" title={m.name}>
                        {m.name}
                      </p>
                      <div className="min-h-[200px] lg:min-h-[280px] max-h-[min(38vh,420px)] lg:max-h-[calc(100vh-220px)]">
                        {showPdfFrame ? (
                          <iframe
                            title={m.name}
                            src={materialUrl}
                            className="w-full h-full min-h-[200px] lg:min-h-[300px] bg-white/5 border-0"
                          />
                        ) : (
                          <img
                            src={materialUrl}
                            alt={m.name}
                            className="w-full h-full max-h-[min(38vh,420px)] lg:max-h-[calc(100vh-240px)] object-contain object-top bg-black/30"
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
              ) : q.question_type === 'multiple' ? (
                <div className="ml-10 space-y-3">
                  <p className="text-xs text-gray-500">
                    Düzgün cavabları aralarında boşluq və işarə olmadan yalnız bitişik rəqəmlərlə yazın
                    <span className="block mt-1">
                      Nümunə: <span className="font-mono text-indigo-300">13</span>
                    </span>
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-3 py-2.5 text-white text-sm font-mono outline-none focus:border-blue-500"
                    placeholder="məs. 134"
                    value={answers[q.id] || ''}
                    onChange={(e) =>
                      setAnswers((p) => ({ ...p, [q.id]: e.target.value.replace(/\D/g, '') }))
                    }
                  />
                </div>
              ) : q.question_type === 'matching' ? (
                <div className="ml-10 space-y-3">
                  <p className="text-xs text-gray-500">
                    Cavabınızı rəqəm+hərf cütləri ilə bitişik yazın (boşluq yoxdur; ardıcıllıq fərqi etmir).
                    <span className="block mt-1">
                      Nümunə: <span className="font-mono text-indigo-300">1a2b3c</span>
                    </span>
                  </p>
                  <input
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-3 py-2.5 text-white text-sm font-mono outline-none focus:border-blue-500"
                    placeholder="məs. 1a2b3c"
                    value={answers[q.id] || ''}
                    onChange={(e) =>
                      setAnswers((p) => ({
                        ...p,
                        [q.id]: e.target.value.toLowerCase().replace(/[^0-9a-z]/g, ''),
                      }))
                    }
                  />
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
    <div className="p-4 sm:p-6 w-full min-w-0 max-w-3xl mx-auto">
      <h1 className="font-display font-bold text-2xl mb-6 break-words">İmtahanlarım</h1>

      {listError && !listLoading && (
        <Card className="p-4 sm:p-5 mb-6 border-red-500/35 bg-red-500/5">
          <p className="text-red-300 text-sm mb-4">{listError}</p>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setListError(null)
              loadExams(false)
            }}
          >
            Yenidən yüklə
          </Button>
        </Card>
      )}

      {result !== null && (
        <Card className="p-6 mb-6 text-center border-blue-500/40">
          <div className="text-5xl mb-3">{result >= 75 ? '🏆' : result >= 60 ? '🥈' : '📚'}</div>
          <div className="font-display font-extrabold text-4xl bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            {formatScoreBal(result)}
          </div>
          <div className="text-gray-400 mt-2">Son imtahan nəticəniz</div>
        </Card>
      )}

      {resultBreakdown?.length > 0 && (
        <Card className="p-6 mb-6 border-indigo-500/30">
          <h2 className="font-display font-bold text-lg text-white mb-1">Suallar üzrə nəticə</h2>
          <p className="text-xs text-gray-500 mb-4">Yazdığınız cavabların xülasəsi.</p>
          <div className="space-y-3 max-h-[min(70vh,520px)] overflow-y-auto pr-1">
            {resultBreakdown.filter(Boolean).map((row) => (
              <div
                key={row.question_id || row.order}
                className="rounded-xl border border-indigo-500/20 bg-[#13112e]/80 p-4 text-left"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <span className="text-sm font-bold text-indigo-300">Sual {row.order}</span>
                  <span className="text-[11px] uppercase tracking-wide text-gray-500">
                    {questionTypeLabelAz(row.question_type)}
                  </span>
                </div>
                <p className="text-sm text-gray-300 mb-3 leading-snug">{row.question_text}</p>
                <div className="grid gap-2 text-sm">
                  <div>
                    <span className="text-xs text-gray-500 block mb-0.5">Sizin cavabınız</span>
                    <code className="block text-amber-200/90 font-mono text-xs break-all bg-black/25 rounded-lg px-2 py-1.5">
                      {row.student_answer}
                    </code>
                  </div>
                  {row.correct_display ? (
                    <div>
                      <span className="text-xs text-gray-500 block mb-0.5">Şablon / nümunə</span>
                      <code className="block text-indigo-200/90 font-mono text-xs break-all bg-black/20 rounded-lg px-2 py-1.5">
                        {row.correct_display}
                      </code>
                    </div>
                  ) : null}
                </div>
                <div className="mt-3">
                  <span
                    className={
                      'inline-flex text-xs font-bold px-2.5 py-1 rounded-lg ' +
                      (row.status_label === 'Düzgün' || row.status_label === 'Doğru'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : row.status_label === 'Səhv'
                          ? 'bg-red-500/15 text-red-300'
                          : row.status_label === 'Cavabsız'
                            ? 'bg-amber-500/15 text-amber-200'
                            : 'bg-gray-500/15 text-gray-400')
                    }
                  >
                    {row.status_label === 'Manual qiymətləndirmə' ? 'Yoxlanılır' : row.status_label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {listLoading ? (
        <div className="text-center py-16 text-gray-500">İmtahanlar yüklənir…</div>
      ) : (
      <div className="space-y-4">
        {exams.map((exam) => {
          if (!exam?.id) return null
          const now = new Date()
          const w = parseExamWindow(exam)
          const start = w.from
          const until = w.until
          const dur = Number(exam.duration_minutes) || 0
          const personalStart = exam.started_at ? new Date(exam.started_at) : null
          const personalEnd =
            personalStart && !Number.isNaN(personalStart.getTime())
              ? new Date(personalStart.getTime() + dur * 60000)
              : null
          const canResume = !!(personalStart && personalEnd && now <= personalEnd)
          const lateUntil = exam.late_access_until ? new Date(exam.late_access_until) : null
          const inLateWindow =
            !!(
              lateUntil &&
              !Number.isNaN(lateUntil.getTime()) &&
              now <= lateUntil
            )
          const inGlobalWindow = !!(start && until && now >= start && now <= until)
          const canStart = !!(start && until && (inGlobalWindow || inLateWindow))
          const isDone = !!exam.submitted_at

          return (
            <Card key={exam.id} className="p-4 sm:p-5 min-w-0 overflow-hidden">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-display font-bold text-lg mb-2 break-words">{exam.title}</h3>
                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 text-sm text-gray-400">
                    {until ? (
                      <span className="break-all">
                        🕘{' '}
                        {start
                          ? `${formatAzDateTime(start)} – ${formatAzDateTime(until)}`
                          : `${formatAzDateTime(until)}-a qədər`}
                      </span>
                    ) : (
                      <span className="text-amber-400/90">📅 Vaxt təyin olunmayıb</span>
                    )}
                    <span>⏱ {exam.duration_minutes ?? '—'} dəq</span>
                  </div>
                  {isDone && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <div className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-semibold inline-block max-w-full break-words">
                      ✓ Tamamlandı — {formatScoreBal(exam?.score)}
                      </div>
                      {exam.rank_in_group ? (
                        <div className="px-3 py-1 bg-indigo-500/15 text-indigo-200 border border-indigo-400/25 rounded-lg text-xs font-bold inline-block">
                          Qrupda {exam.rank_in_group}-ci yer{exam.my_group ? ` (${exam.my_group})` : ''}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
                <div className="shrink-0 self-start sm:self-center">
                  {isDone ? (
                    <div className="flex gap-2 flex-wrap justify-start sm:justify-end">
                      <Button variant="secondary" size="sm" onClick={() => openPastReview(exam)}>
                        📋 Nəticəyə bax
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => void openLeaderboard(exam)}>
                        🏆 Reytinq
                      </Button>
                    </div>
                  ) : !until ? (
                    <span className="text-xs text-amber-400/90 bg-[#13112e] px-3 py-2 rounded-xl inline-block">
                      Müəllim vaxt təyin etməlidir
                    </span>
                  ) : canResume ? (
                    <Button onClick={() => startExam(exam)}>↩️ Davam et</Button>
                  ) : canStart ? (
                    <Button onClick={() => startExam(exam)}>🚀 Başla</Button>
                  ) : (
                    <span className="text-xs text-gray-500 bg-[#13112e] px-3 py-2 rounded-xl inline-block">⛔ Aktiv deyil</span>
                  )}
                </div>
              </div>
              {!isDone && until && (
                <div className="mt-3 text-[12px] text-gray-400">
                  {start
                    ? `İmtahan ${formatAzDateTime(start)} – ${formatAzDateTime(until)} aralığında aktivdir.`
                    : `İmtahan ${formatAzDateTime(until)}-a qədər aktivdir.`}{' '}
                  Daxil olduğunuz andan etibarən {dur} dəqiqə vaxtınız olacaq. İnternetinizin sabit olduğundan əmin olun.
                </div>
              )}
            </Card>
          )
        })}
        {!exams.length && (
          <div className="text-center py-16 text-gray-500">Sizin üçün imtahan yoxdur</div>
        )}
      </div>
      )}

      {/* Modal open=false olanda belə React children-ı hesablayır; reviewModal null ikən
          reviewModal?.loading hər ikisi falsedur və üçüncü budaq null.score ilə çökürdü */}
      {reviewModal != null && (
      <Modal
        open
        onClose={() => setReviewModal(null)}
        title={reviewModal.title || 'İmtahan nəticəsi'}
        size="lg"
      >
        {reviewModal.loading ? (
          <p className="text-gray-500 text-center py-10">Yüklənir…</p>
        ) : reviewModal.error ? (
          <p className="text-red-400 text-sm text-center py-6">{reviewModal.error}</p>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="font-display font-extrabold text-3xl bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                {formatScoreBal(reviewModal.score)}
              </div>
              {reviewModal.submitted_at && (
                <p className="text-xs text-gray-500 mt-2">
                  Təqdim: {new Date(reviewModal.submitted_at).toLocaleString('az-AZ')}
                </p>
              )}
            </div>
            {reviewModal.breakdown?.length > 0 && (
              <div className="space-y-3 max-h-[min(60vh,480px)] overflow-y-auto pr-1">
                <h3 className="text-sm font-bold text-white mb-2">Suallar üzrə</h3>
                {reviewModal.breakdown.filter(Boolean).map((row) => (
                  <div
                    key={row.question_id || row.order}
                    className="rounded-xl border border-indigo-500/20 bg-[#13112e]/80 p-4 text-left"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <span className="text-sm font-bold text-indigo-300">Sual {row.order}</span>
                      <span className="text-[11px] uppercase tracking-wide text-gray-500">
                        {questionTypeLabelAz(row.question_type)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mb-3 leading-snug">{row.question_text}</p>
                    <div className="grid gap-2 text-sm">
                      <div>
                        <span className="text-xs text-gray-500 block mb-0.5">Sizin cavabınız</span>
                        <code className="block text-amber-200/90 font-mono text-xs break-all bg-black/25 rounded-lg px-2 py-1.5">
                          {row.student_answer}
                        </code>
                      </div>
                      {row.correct_display ? (
                        <div>
                          <span className="text-xs text-gray-500 block mb-0.5">Şablon / nümunə</span>
                          <code className="block text-indigo-200/90 font-mono text-xs break-all bg-black/20 rounded-lg px-2 py-1.5">
                            {row.correct_display}
                          </code>
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-3">
                      <span
                        className={
                          'inline-flex text-xs font-bold px-2.5 py-1 rounded-lg ' +
                          (row.status_label === 'Düzgün' || row.status_label === 'Doğru'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : row.status_label === 'Səhv'
                              ? 'bg-red-500/15 text-red-300'
                              : row.status_label === 'Cavabsız'
                                ? 'bg-amber-500/15 text-amber-200'
                                : 'bg-gray-500/15 text-gray-400')
                        }
                      >
                        {row.status_label === 'Manual qiymətləndirmə' ? 'Yoxlanılır' : row.status_label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Modal>
      )}

      {leaderModal != null && (
      <Modal
        open
        onClose={() => setLeaderModal(null)}
        title={leaderModal.title ? `Reytinq — ${leaderModal.title}` : 'Reytinq'}
        size="lg"
      >
        {leaderModal.loading ? (
          <p className="text-gray-500 text-center py-10">Yüklənir…</p>
        ) : leaderModal.error ? (
          <p className="text-red-400 text-sm text-center py-6">{leaderModal.error}</p>
        ) : (
          <div className="space-y-3">
            {leaderModal.grade ? (
              <p className="text-xs text-gray-500">
                Qrup: <span className="text-gray-200 font-semibold">{leaderModal.grade}</span>
              </p>
            ) : null}
            {leaderModal.results.length === 0 ? (
              <p className="text-sm text-gray-500">Nəticə yoxdur.</p>
            ) : (
              <div className="space-y-2 max-h-[min(65vh,520px)] overflow-y-auto pr-1">
                {leaderModal.results.map((r) => {
                  const rank = r.rank || 0
                  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
                  const mine = user?.id && r.student_id && String(r.student_id) === String(user.id)
                  return (
                    <div
                      key={r.student_id}
                      className={[
                        'rounded-xl border px-4 py-3 flex items-center justify-between gap-3',
                        mine ? 'border-indigo-400/60 bg-indigo-500/10' : 'border-indigo-500/15 bg-[#13112e]/70',
                      ].join(' ')}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {medal ? `${medal} ` : ''}{rank ? `${rank}. ` : ''}{r.full_name || '—'}
                        </p>
                        <p className="text-[11px] text-gray-500 font-mono tabular-nums mt-1">
                          {Number.isFinite(Number(r.duration_seconds)) ? `${Math.round(Number(r.duration_seconds))}s` : '—'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-extrabold text-white">{formatScoreBal(r.score)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Modal>
      )}
    </div>
  )
}
