import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import Countdown from '../../components/exam/Countdown'
import ExamBreakdownList from '../../components/exam/ExamBreakdownList'
import { useToast } from '../../components/common/Toast'
import useUiStore from '../../hooks/useUi'
import useAuthStore from '../../hooks/useAuth'
import PhoneInput from '../../components/auth/PhoneInput'
import GroupSwitcher from '../../components/student/GroupSwitcher'
import { useStudentGroups } from '../../contexts/StudentGroupContext'
import { withEnrollmentQuery } from '../../lib/studentGroupQuery'

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

const examInputCls =
  'w-full rounded-xl px-3 py-2.5 text-sm font-mono outline-none border border-[color:var(--border-subtle)] bg-token-surfaceCard/55 text-token-textMain placeholder:text-token-textMuted focus:border-primary/40'

/** Serverdən gələn /api/uploads/... üçün tam URL (VITE_API_URL=https://host/api və ya /api) */
function resolveMaterialUrl(rel) {
  if (!rel || typeof rel !== 'string') return ''
  let r = String(rel).trim()
  if (r.startsWith('//') && typeof window !== 'undefined') {
    r = `${window.location.protocol}${r}`
  }
  if (r.startsWith('http')) {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && r.startsWith('http:')) {
      r = `https:${r.slice('http:'.length)}`
    }
    return r
  }
  const p = r.startsWith('/') ? r : `/${r}`
  const rawBase = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')
  let origin = ''
  if (rawBase) {
    if (rawBase.startsWith('/')) {
      const stripped = rawBase.replace(/\/api\/?$/, '')
      origin = (typeof window !== 'undefined' ? window.location.origin : '') + stripped
    } else {
      origin = rawBase.replace(/\/api\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : '')
    }
  } else if (typeof window !== 'undefined') {
    origin = window.location.origin
  }
  if (!origin && typeof window !== 'undefined') origin = window.location.origin
  return origin ? `${origin}${p}` : p
}

/** Diskdə /api/uploads/exams/uuid.ext — bəzi hostlarda statik proxysiz; API ilə Bearer göndərilir */
function examUploadsStoredFilename(url) {
  const s = String(url || '')
  let m = s.match(/\/api\/uploads\/exams\/([^/?#]+)$/i)
  if (m) return decodeURIComponent(m[1])
  m = s.match(/uploads\/exams\/([^/?#]+)$/i)
  return m ? decodeURIComponent(m[1]) : null
}

function materialFileApiPath(url, examId) {
  const fn = examUploadsStoredFilename(url)
  if (!fn || !examId) return null
  return `/exams/by-exam/${encodeURIComponent(examId)}/attachment/${encodeURIComponent(fn)}`
}

function apiAbsoluteUrl(pathnameWithLeadingSlash) {
  const p = String(pathnameWithLeadingSlash || '')
  if (!p) return ''
  const base = String(api?.defaults?.baseURL || '/api').replace(/\/+$/, '')
  if (base.startsWith('http')) return `${base}${p}`
  if (typeof window === 'undefined') return `${base}${p}`
  const pref = base.startsWith('/') ? base : `/${base}`
  return `${window.location.origin}${pref}${p}`
}

/** Yeni pəncərə: img Authorization göndərmir → qısa müddətli token URL */
function materialOpenInNewTabUrl(rel, examId) {
  const s = String(rel || '')
  const directAttachmentPath =
    s && !s.includes('://') && s.includes('/exams/by-exam/') && s.includes('/attachment/') ? (s.startsWith('/') ? s : `/${s}`) : null

  // If backend already returned the attachment endpoint path, just prefix API root and append token.
  if (directAttachmentPath) {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('mx_token') : ''
    const withToken = token
      ? `${directAttachmentPath}${directAttachmentPath.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
      : directAttachmentPath
    return apiAbsoluteUrl(withToken)
  }

  const fn = examUploadsStoredFilename(rel)
  if (!fn || !examId) return resolveMaterialUrl(rel)
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('mx_token') : ''
  if (!token) return resolveMaterialUrl(rel)
  const path = `/exams/by-exam/${encodeURIComponent(examId)}/attachment/${encodeURIComponent(fn)}?token=${encodeURIComponent(token)}`
  return apiAbsoluteUrl(path)
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

/** Şəkil uzantısı URL və ya adda varsa — iframe istifadə etmə (iframe PNG/JPEG göstərmir) */
function looksRaster(pathOrName) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(String(pathOrName || ''))
}

/** PDF yalnız həqiqətən pdf faylıdırsa; ad .pdf yazılıb URL .png olanda img */
function shouldUsePdfIframe(m) {
  if (!m) return false
  if (looksRaster(m.url) || looksRaster(m.name)) return false
  if (isMaterialPdf(m.url)) return true
  if (isMaterialPdf(m.name) && !looksRaster(m.url)) return true
  return false
}

/** UI mətnləri: yalnız şəkil, yalnız PDF və ya qarışıq */
function materialsKinds(materials) {
  const list = Array.isArray(materials) ? materials : []
  let anyPdf = false
  let anyRaster = false
  for (const m of list) {
    if (shouldUsePdfIframe(m)) anyPdf = true
    if (looksRaster(m.url) || looksRaster(m.name)) anyRaster = true
  }
  return { anyPdf, anyRaster }
}

function toggleMaterialsButtonLabel(open, { anyPdf, anyRaster }) {
  if (open) {
    if (anyPdf && anyRaster) return 'Faylları gizlət'
    if (anyPdf) return 'PDF gizlət'
    if (anyRaster) return 'Şəkli gizlət'
    return 'Gizlət'
  }
  if (anyPdf && anyRaster) return 'PDF / şəkil'
  if (anyPdf) return 'PDF göstər'
  if (anyRaster) return 'Şəkil göstər'
  return 'Materiallar'
}

function materialsAsideTitle(count, { anyPdf, anyRaster }) {
  if (anyPdf && anyRaster) return `Suallar (PDF / şəkil) — ${count} fayl`
  if (anyPdf) return `Suallar (PDF) — ${count} fayl`
  if (anyRaster) return `Suallar (şəkil) — ${count} fayl`
  return `Suallar — ${count} fayl`
}

function railMaterialsCaption({ anyPdf, anyRaster }) {
  if (anyPdf && !anyRaster) return 'PDF'
  if (anyRaster && !anyPdf) return 'Şəkil'
  return 'Fayl'
}

function questionTypeLabelAz(t) {
  const m = {
    closed: 'Qapalı',
    multiple: 'Çoxseçimli (şablon)',
    matching: 'Uyğunluq',
    sequence: 'Ardıcıllıq',
    open: 'Açıq',
  }
  return m[t] || t
}

function normExamAnswerKey(id) {
  if (id == null) return ''
  return String(id).trim().toLowerCase().replace(/-/g, '')
}

function parseAnswersSnapshot(v) {
  if (v == null) return null
  if (typeof v === 'string') {
    try {
      const o = JSON.parse(v)
      return typeof o === 'object' && o !== null ? o : null
    } catch {
      return null
    }
  }
  if (typeof v === 'object') return v
  return null
}

/** Təqdim / `answers` JSON: bir sualın xam dəyəri (uuid, sıra nömrəsi, 0-based indeks, massiv) */
function pickSubmittedAnswerRaw(answers, questionId, displayOrder) {
  if (!answers || typeof answers !== 'object') return undefined
  if (Array.isArray(answers)) {
    const i = Number(displayOrder) > 0 ? Number(displayOrder) - 1 : -1
    if (i >= 0 && i < answers.length) return answers[i]
    return undefined
  }
  const idStr = questionId == null ? '' : String(questionId)
  if (idStr && Object.prototype.hasOwnProperty.call(answers, idStr)) return answers[idStr]
  if (questionId != null && answers[questionId] !== undefined) return answers[questionId]
  const want = normExamAnswerKey(questionId)
  if (want) {
    for (const k of Object.keys(answers)) {
      if (normExamAnswerKey(k) === want) return answers[k]
    }
  }
  if (displayOrder != null) {
    const d = String(displayOrder).trim()
    if (d && answers[d] !== undefined) return answers[d]
    const n = Number(displayOrder)
    if (Number.isFinite(n) && answers[n] !== undefined) return answers[n]
    if (Number.isFinite(n) && n >= 1) {
      const z = String(n - 1)
      if (answers[z] !== undefined) return answers[z]
    }
  }
  return undefined
}

function formatSubmittedAnswerText(raw) {
  if (raw == null) return ''
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
    return String(raw).replace(/\uFEFF/g, '').trim()
  }
  if (typeof raw === 'object') {
    for (const k of ['choice', 'key', 'value', 'answer', 'letter', 'text']) {
      if (raw[k] != null && String(raw[k]).trim() !== '') {
        return String(raw[k]).replace(/\uFEFF/g, '').trim()
      }
    }
  }
  return String(raw).replace(/\uFEFF/g, '').trim()
}

/** Breakdown + DB/təqdim `answers` — mövcud olduqda tələbə cavabını həmişə `answers`-dan göstərir */
function mergeReviewBreakdownWithAnswers(breakdown, answers) {
  if (!Array.isArray(breakdown)) return []
  const snap = parseAnswersSnapshot(answers)
  if (!snap || typeof snap !== 'object') return breakdown
  return breakdown.map((row) => {
    const raw = pickSubmittedAnswerRaw(snap, row.question_id, row.order)
    const txt = formatSubmittedAnswerText(raw)
    if (!txt) return row
    return { ...row, student_answer: txt }
  })
}

const SUMMARY_TYPE_KEYS = ['closed', 'multiple', 'matching', 'open']

/** Backend `buildExamTypeSummary` cavabı */
function ExamTypeSummaryPanel({ summary }) {
  const bt = summary?.by_type
  if (!bt || typeof bt !== 'object') return null
  const rows = SUMMARY_TYPE_KEYS.map((k) => {
    const r = bt[k] || {}
    const c = Number(r.correct) || 0
    const w = Number(r.wrong) || 0
    const u = Number(r.unanswered) || 0
    const p = Number(r.pending) || 0
    const pts = Number(r.points)
    const total = c + w + u + p
    return { k, c, w, u, p, pts, total }
  }).filter((row) => row.total > 0 || Number.isFinite(row.pts))
  if (!rows.length) return null
  return (
    <div className="rounded-xl border border-cyan-500/25 bg-cyan-950/15 p-4 mb-4 text-left">
      <h3 className="text-sm font-bold text-cyan-100 mb-3">Sual tipinə görə xülasə</h3>
      <p className="text-xs text-gray-500 mb-3">
        Hər tipdə neçə sual düzgün / səhv / cavabsız (və lazım olsa müəllim yoxlaması) və bu tiplərdən toplanan avtomatik bal.
      </p>
      <div className="overflow-x-auto rounded-lg border border-indigo-500/20">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="bg-[#0f0e24] text-gray-400">
              <th className="px-3 py-2 font-semibold">Tip</th>
              <th className="px-2 py-2 font-semibold text-center">Düzgün</th>
              <th className="px-2 py-2 font-semibold text-center">Səhv</th>
              <th className="px-2 py-2 font-semibold text-center">Cavabsız</th>
              <th className="px-2 py-2 font-semibold text-center">Yoxlanılır</th>
              <th className="px-3 py-2 font-semibold text-right">Bal (tip)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.k} className="border-t border-indigo-500/15 text-gray-200">
                <td className="px-3 py-2 font-medium text-white">{questionTypeLabelAz(row.k)}</td>
                <td className="px-2 py-2 text-center tabular-nums">{row.c}</td>
                <td className="px-2 py-2 text-center tabular-nums">{row.w}</td>
                <td className="px-2 py-2 text-center tabular-nums">{row.u}</td>
                <td className="px-2 py-2 text-center tabular-nums">{row.p}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-cyan-200/95">
                  {Number.isFinite(row.pts) ? `${row.pts}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {summary?.raw_sum != null && summary?.score != null && Number(summary.raw_sum) !== Number(summary.score) ? (
        <p className="text-[11px] text-amber-400/90 mt-2">
          Mənfi cərimədən sonra ümumi bal sıfırdan aşağı düşməyəcək şəkildə yuvarlanıb (xam cəmi: {summary.raw_sum}).
        </p>
      ) : null}
    </div>
  )
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
  const [searchParams, setSearchParams] = useSearchParams()
  const deepLinkExamId = searchParams.get('exam')
  const deepLinkHandledRef = useRef('')
  const [exams, setExams] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState(null)
  const [activeExam, setActiveExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [startedAt, setStartedAt] = useState(null)
  const [result, setResult] = useState(null)
  const [resultBreakdown, setResultBreakdown] = useState(null)
  const [resultTypeSummary, setResultTypeSummary] = useState(null)
  const [materialsOpen, setMaterialsOpen] = useState(true)
  /** /api/uploads/exams/... üçün blob URL (JWT ilə GET /exams/material-file/...) */
  const [materialBlobById, setMaterialBlobById] = useState({})
  const [, bumpListUi] = useState(0)
  const activeExamRef = useRef(false)
  activeExamRef.current = !!activeExam
  /** Siyahıdan avtomatik `/review` yükləməsinin təkrarlanmaması üçün */
  const lastListReviewKeyRef = useRef('')
  const toast = useToast()
  const { setFocusMode, theme } = useUiStore()
  const { user, setSession } = useAuthStore()
  const token = useAuthStore((s) => s.token)
  const [phonePromptOpen, setPhonePromptOpen] = useState(false)
  const [contactPhone, setContactPhone] = useState('')
  const [phonePromptBusy, setPhonePromptBusy] = useState(false)

  const materialBlobLoadKey = useMemo(() => {
    if (!activeExam) return ''
    const files = normalizeExamFiles(activeExam)
    return `${activeExam.id}\0${startedAt || ''}\0${files.map((f) => f.url).join('\0')}`
  }, [activeExam, startedAt])

  useEffect(() => {
    if (!materialBlobLoadKey || !activeExam) {
      setMaterialBlobById({})
      return undefined
    }
    const files = normalizeExamFiles(activeExam)
    const ac = new AbortController()
    const toRevoke = []

    ;(async () => {
      const next = {}
      for (const m of files) {
        const apiPath = materialFileApiPath(m.url, activeExam.id)
        if (!apiPath) {
          next[m.id] = null
          continue
        }
        try {
          const blob = await api.get(apiPath, { responseType: 'blob', signal: ac.signal })
          const u = URL.createObjectURL(blob)
          toRevoke.push(u)
          next[m.id] = u
        } catch (e) {
          if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return
          next[m.id] = null
        }
      }
      if (!ac.signal.aborted) setMaterialBlobById(next)
    })()

    return () => {
      ac.abort()
      toRevoke.forEach((u) => URL.revokeObjectURL(u))
      setMaterialBlobById({})
    }
  }, [materialBlobLoadKey, activeExam])

  /** Davam / yenidən yükləmə: materiallar paneli açılsın (sıfır enində PNG iframe/img sıradan çıxmasın) */
  useEffect(() => {
    if (activeExam && normalizeExamFiles(activeExam).length > 0) {
      setMaterialsOpen(true)
    }
  }, [activeExam?.id, startedAt])

  /** quiet: arxa plan yeniləməsində tam səhifə “yüklənir” göstərmə */
  const { activeEnrollmentId, activeEnrollment } = useStudentGroups()

  const loadExams = useCallback((quiet = false) => {
    if (!quiet) setListLoading(true)
    return api
      .get(withEnrollmentQuery('/exams/my', activeEnrollmentId))
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
  }, [activeEnrollmentId, toast])

  const [reviewModal, setReviewModal] = useState(null)
  const [leaderModal, setLeaderModal] = useState(null)
  /** Paylaşım linkindən gələndə imtahanı birbaşa açmırıq — təsdiq modalı */
  const [startConfirm, setStartConfirm] = useState(null) // { exam, mode: 'fresh' | 'continue' }
  /** Təyinat yoxdursa müəllimə giriş sorğusu */
  const [accessPrompt, setAccessPrompt] = useState(null)
  const [accessRequestBusy, setAccessRequestBusy] = useState(false)

  useEffect(() => {
    loadExams(false)
  }, [loadExams])

  const studentHasContactPhone = useMemo(() => {
    const p = String(user?.phone_number || user?.phone || '').replace(/\D/g, '')
    return p.length >= 9
  }, [user?.phone, user?.phone_number])

  useEffect(() => {
    if (!user || user.role !== 'student' || studentHasContactPhone || listLoading) return
    if (!exams.length) return
    try {
      if (sessionStorage.getItem('mx_student_phone_prompt_skip') === '1') return
    } catch {
      /* ignore */
    }
    setPhonePromptOpen(true)
  }, [user, studentHasContactPhone, exams.length, listLoading])

  const saveContactPhone = async () => {
    setPhonePromptBusy(true)
    try {
      const r = await api.patch('/auth/profile', { phone_number: contactPhone })
      if (r?.user) {
        setSession(token, r.user)
        toast('Mobil nömrə saxlanıldı', 'success')
        setPhonePromptOpen(false)
      }
    } catch (err) {
      toast(err?.message || 'Telefon saxlanılmadı', 'error')
    } finally {
      setPhonePromptBusy(false)
    }
  }

  /**
   * Təqdimdən dərhal sonra breakdown `submit` cavabından gəlir; səhifə yenilənəndə state itir.
   * Siyahı yenilənəndə ən son təqdim olunmuş imtahan üçün `/review` ilə xülasəni bir dəfə doldururuq.
   */
  useEffect(() => {
    if (activeExam) return
    if (!Array.isArray(exams) || exams.length === 0) return
    const completed = exams.filter((e) => e?.submitted_at)
    if (!completed.length) return
    let latest = completed[0]
    for (const e of completed) {
      const t = new Date(e.submitted_at).getTime()
      const t0 = new Date(latest.submitted_at).getTime()
      if (t > t0) latest = e
    }
    if (!latest?.id) return
    const key = `${latest.id}:${latest.submitted_at || ''}`
    if (lastListReviewKeyRef.current === key) return
    const ac = new AbortController()
    api
      .get(`/exams/${latest.id}/review`, { signal: ac.signal })
      .then((d) => {
        lastListReviewKeyRef.current = key
        setResult(d.score ?? null)
        const br = Array.isArray(d.breakdown) ? d.breakdown : []
        setResultBreakdown(mergeReviewBreakdownWithAnswers(br, d.answers))
        setResultTypeSummary(d.type_summary ?? null)
      })
      .catch(() => {
        /* icazə yoxdursa və s. */
      })
    return () => ac.abort()
  }, [exams, activeExam])

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
      exam_files: null,
      exam_id: exam?.id || null,
      type_summary: null,
      score: null,
      submitted_at: null,
      error: null,
    })
    try {
      const d = await api.get(`/exams/${exam.id}/review`)
      const files = normalizeExamFiles(d.exam || exam)
      const br = Array.isArray(d.breakdown) ? d.breakdown : []
      const merged = mergeReviewBreakdownWithAnswers(br, d.answers)
      setReviewModal({
        title: exam.title,
        loading: false,
        breakdown: merged,
        exam_files: files,
        exam_id: d?.exam?.id || exam?.id || null,
        type_summary: d.type_summary || null,
        score: d.score,
        submitted_at: d.submitted_at,
        error: null,
      })
    } catch (err) {
      setReviewModal({
        title: exam.title,
        loading: false,
        breakdown: [],
        exam_files: [],
        exam_id: exam?.id || null,
        type_summary: null,
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
      // Defense-in-depth: imtahan bitənə qədər düzgün cavablar UI-a buraxılmır
      setQuestions(
        Array.isArray(data.questions)
          ? data.questions.map((q) => {
              if (!q || typeof q !== 'object') return q
              const { correct_answer: _ca, ...rest } = q
              if (rest.question_type === 'matching') {
                return { ...rest, options: null }
              }
              if (rest.question_type === 'open') {
                const { template_hint: _th, ...openRest } = rest
                return openRest
              }
              return rest
            })
          : []
      )
      setAnswers({})
      setStartedAt(data?.started_at || new Date().toISOString())
      setResult(null)
      setResultBreakdown(null)
      setResultTypeSummary(null)
      setMaterialsOpen(true)
      setFocusMode(true)
    } catch (err) {
      toast(err.message || 'Xəta', 'error')
    }
  }

  const submitExamAccessRequest = async () => {
    const examId = accessPrompt?.exam?.id
    if (!examId) return
    setAccessRequestBusy(true)
    try {
      const r = await api.post(`/exams/${encodeURIComponent(examId)}/access-request`)
      toast(r?.message || 'Sorğunuz göndərildi', 'success')
      setAccessPrompt({ exam: accessPrompt.exam, pending: true })
      setSearchParams({}, { replace: true })
    } catch (err) {
      toast(err?.message || 'Sorğu göndərilmədi', 'error')
    } finally {
      setAccessRequestBusy(false)
    }
  }

  /** Paylaşım linki: /student/exams?exam=uuid */
  useEffect(() => {
    const targetId = deepLinkExamId ? String(deepLinkExamId).trim() : ''
    if (!targetId || listLoading || activeExam) return
    if (deepLinkHandledRef.current === targetId) return

    const exam = exams.find((e) => e?.id != null && String(e.id) === targetId)
    if (!exam) {
      void (async () => {
        try {
          const d = await api.get(`/exams/${encodeURIComponent(targetId)}/access-status`)
          if (d?.assigned && d?.exam) {
            deepLinkHandledRef.current = ''
            toast('İmtahan siyahısı yenilənir…', 'info')
            await loadExams(true)
            return
          }
          deepLinkHandledRef.current = targetId
          if (d?.exam) {
            try {
              const sub = await api.post(`/exams/${encodeURIComponent(targetId)}/access-from-link`)
              if (sub?.assigned || sub?.already_assigned) {
                deepLinkHandledRef.current = ''
                toast(sub?.message || 'İmtahana daxil ola bilərsiniz', 'success')
                await loadExams(true)
                return
              }
              setAccessPrompt({
                exam: d.exam,
                pending: true,
                autoSubmitted: Boolean(sub?.created || sub?.already_pending),
              })
              if (sub?.created) {
                toast('Müəllimə sorğu göndərildi — təsdiq gözləyin', 'success')
              }
              return
            } catch (subErr) {
              if (subErr?.code === 'ALREADY_PENDING' || subErr?.message?.includes('artıq göndərilib')) {
                setAccessPrompt({ exam: d.exam, pending: true })
                return
              }
              throw subErr
            }
          }
        } catch (err) {
          deepLinkHandledRef.current = targetId
          toast(err?.message || 'Bu imtahan tapılmadı və ya sizə təyin edilməyib', 'error')
        }
        setSearchParams({}, { replace: true })
      })()
      return
    }

    deepLinkHandledRef.current = targetId
    setSearchParams({}, { replace: true })

    const now = new Date()
    const w = parseExamWindow(exam)
    const start = w?.from
    const until = w?.until
    const lateUntil = exam.late_access_until ? new Date(exam.late_access_until) : null
    const inLateWindow =
      !!(lateUntil && !Number.isNaN(lateUntil.getTime()) && now <= lateUntil)
    const inGlobalWindow = !!(start && until && now >= start && now <= until)
    const inExamWindow = !!(start && until && (inGlobalWindow || inLateWindow))
    const hasOpenAttempt = !!(exam.started_at && !exam.submitted_at)
    const showContinue = hasOpenAttempt && inExamWindow
    const canStartFresh = !hasOpenAttempt && inExamWindow

    if (exam.submitted_at) {
      void openPastReview(exam)
      return
    }
    if (showContinue || canStartFresh) {
      setStartConfirm({ exam, mode: showContinue ? 'continue' : 'fresh' })
      return
    }
    if (start && now < start) {
      toast(`İmtahan ${formatAzDateTime(start)} tarixində başlayacaq`, 'info')
      return
    }
    toast('İmtahan hazırda aktiv deyil', 'error')
    // openPastReview / startExam: stable enough per render; deepLinkHandledRef prevents repeats
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkExamId, exams, listLoading, activeExam, setSearchParams, toast])

  const submitExam = async () => {
    try {
      const data = await api.post('/exams/submit', {
        exam_id: activeExam.id,
        answers,
      })
      setResult(data?.score ?? null)
      const br = Array.isArray(data?.breakdown) ? data.breakdown : []
      setResultBreakdown(mergeReviewBreakdownWithAnswers(br, data.answers))
      setResultTypeSummary(data?.type_summary ?? null)
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
    const materialKinds = materialsKinds(materials)
    const w = parseExamWindow(activeExam)

    return (
      <div className="flex flex-col flex-1 min-h-0 h-full max-h-full overflow-hidden w-full min-w-0">
        {/* Mobil: mətn + taymer bir sırada daralır; sütun düzümü üst-üstə düşməni aradan qaldırır */}
        <div className="bg-[#13112e] border-b border-indigo-500/20 px-3 sm:px-6 py-3 sm:py-4 shrink-0 z-30">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-4">
            <div className="w-full min-w-0 lg:flex-1 lg:min-w-0 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-display font-bold text-base sm:text-lg text-white break-words">
                  {activeExam.title}
                </div>
                <div className="text-xs text-gray-400">{questions.length} sual</div>
                {w?.until && (
                  <p className="text-[11px] text-gray-400 mt-1.5 leading-snug break-words hyphens-auto">
                    İmtahan {formatAzDateTime(w.until)}-a qədər aktivdir. Daxil olduğunuz andan etibarən {durActive}{' '}
                    dəqiqə vaxtınız var. İnternetinizin sabit olduğundan əmin olun.
                  </p>
                )}
              </div>
              {materials.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMaterialsOpen((v) => !v)}
                  className="self-start shrink-0 text-xs font-semibold text-blue-400 border border-indigo-500/30 rounded-lg px-3 py-1.5 hover:bg-white/5 lg:hidden"
                >
                  {toggleMaterialsButtonLabel(materialsOpen, materialKinds)}
                </button>
              )}
            </div>
            <div className="flex flex-row items-center justify-between gap-3 w-full min-w-0 sm:w-auto lg:justify-end lg:gap-6 shrink-0 border-t border-indigo-500/15 pt-3 lg:border-t-0 lg:pt-0">
              <Countdown endTime={endTime} onExpire={submitExam} />
              <div className="text-right shrink-0 pl-2">
                <div className="text-xs sm:text-sm text-gray-400 whitespace-nowrap">
                  {Object.keys(answers).length}/{questions.length} cavablandı
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 min-w-0 flex-col lg:flex-row overflow-hidden">
          {materials.length > 0 && (
            <aside
              className={
                'shrink-0 bg-[#0f0c29]/80 min-h-0 min-w-0 border-indigo-500/20 transition-[max-height,opacity] duration-300 ease-in-out ' +
                (materialsOpen
                  ? 'flex flex-col max-h-[min(38svh,320px)] sm:max-h-[42vh] lg:max-h-none w-full lg:w-[min(48%,560px)] lg:min-w-[280px] lg:max-w-[min(48%,560px)] border-b lg:border-b-0 lg:border-r border-indigo-500/20 overflow-hidden'
                  : 'hidden lg:flex lg:flex-col lg:max-h-none w-full lg:w-[min(48%,560px)] lg:min-w-[280px] lg:max-w-[min(48%,560px)] lg:border-r border-indigo-500/20 overflow-hidden')
              }
              aria-hidden={false}
            >
              <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2 shrink-0 border-b border-indigo-500/15">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider truncate">
                  {materialsAsideTitle(materials.length, materialKinds)}
                </p>
                <button
                  type="button"
                  onClick={() => setMaterialsOpen(false)}
                  className="inline-flex lg:hidden shrink-0 text-xs font-semibold text-blue-400 hover:text-blue-300 px-2 py-1 rounded-lg border border-indigo-500/30 hover:bg-white/5"
                >
                  ← Gizlət
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-4">
                {materials.map((m) => {
                  const materialUrlDirect = resolveMaterialUrl(m.url)
                  const needsProtectedFetch = Boolean(materialFileApiPath(m.url, activeExam.id))
                  const blobEntry = materialBlobById[m.id]
                  const mediaSrc = needsProtectedFetch
                    ? blobEntry === undefined
                      ? undefined
                      : blobEntry === null
                        ? materialUrlDirect
                        : blobEntry
                    : materialUrlDirect
                  const showPdfFrame = shouldUsePdfIframe(m)
                  const mediaBoxClass = showPdfFrame
                    ? 'min-h-[200px] lg:min-h-[280px] max-h-[min(38vh,420px)] lg:max-h-[calc(100vh-220px)]'
                    : 'flex flex-col min-h-[120px] sm:min-h-[180px] lg:min-h-[260px] max-h-[min(34svh,360px)] sm:max-h-[min(38vh,420px)] lg:max-h-[calc(100vh-220px)] min-w-0'
                  return (
                    <div
                      key={m.id}
                      className="rounded-xl border border-indigo-500/20 overflow-hidden bg-black/20 flex flex-col"
                    >
                      <p className="text-xs text-gray-500 px-2 py-1.5 truncate border-b border-indigo-500/10" title={m.name}>
                        {m.name}
                      </p>
                      <div className={mediaBoxClass}>
                        {showPdfFrame ? (
                          <iframe
                            key={`pdf-${m.id}-${startedAt || ''}-${blobEntry || ''}`}
                            title={m.name}
                            src={mediaSrc || undefined}
                            className="w-full h-full min-h-[200px] lg:min-h-[300px] bg-white/5 border-0"
                          />
                        ) : (
                          <div className="flex min-h-0 flex-1 flex-col gap-2 min-w-0">
                            <img
                              key={`img-${m.id}-${startedAt || ''}-${blobEntry || ''}`}
                              src={mediaSrc || undefined}
                              alt={m.name}
                              loading="eager"
                              decoding="async"
                              sizes="(max-width: 1024px) 100vw, min(560px, 50vw)"
                              className="h-auto w-full max-h-full min-h-[96px] flex-1 object-contain object-top bg-black/30"
                            />
                            {materialUrlDirect ? (
                              <a
                                href={materialOpenInNewTabUrl(m.url, activeExam.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-center text-xs font-semibold text-blue-400 hover:text-blue-300 py-1"
                              >
                                Yeni pəncərədə aç
                              </a>
                            ) : null}
                          </div>
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
              className="flex lg:hidden shrink-0 w-11 flex-col items-center justify-center gap-1 border-r border-indigo-500/20 bg-[#13112e] hover:bg-[#1a1740] text-blue-400 text-[11px] font-bold py-6 transition-colors"
            >
              <span className="text-base leading-none" aria-hidden>
                ▶
              </span>
              <span className="[writing-mode:vertical-rl] rotate-180 uppercase tracking-widest max-h-[72px] overflow-hidden">
                {railMaterialsCaption(materialKinds)}
              </span>
            </button>
          )}

          <div className="flex-1 flex flex-col min-h-0 min-w-0 basis-0">
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 space-y-4 sm:space-y-6 touch-pan-y">
          {questions.map((q, i) => (
            <Card key={q.id} className="p-4 sm:p-6">
              <div className="flex flex-wrap gap-2 sm:gap-4 mb-3 sm:mb-4 items-start">
                <span className="bg-blue-500/20 text-blue-300 rounded-lg px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-bold flex-shrink-0">
                  {i + 1}
                </span>
                <p className="text-white font-medium leading-relaxed min-w-0 flex-1 text-sm sm:text-base">
                  {q.question_text ?? `Sual ${i + 1}`}
                </p>
                <span className="text-gray-500 text-xs flex-shrink-0 w-full sm:w-auto sm:ml-auto text-left sm:text-right">
                  {Number(q.points)} bal
                </span>
              </div>

              {q.question_type === 'closed' ? (
                <div className="space-y-2 ml-0 sm:ml-8 lg:ml-10">
                  {q.options?.map((opt, oi) => {
                    const key = String.fromCharCode(65 + oi)
                    const selected = answers[q.id] === key
                    return (
                      <button
                        key={oi}
                        type="button"
                        onClick={() => setAnswers((p) => ({ ...p, [q.id]: key }))}
                        className={`w-full min-w-0 flex items-start gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl border text-left text-sm sm:text-base transition-all touch-manipulation ${
                          selected
                            ? 'border-blue-500 bg-blue-500/15 text-white'
                            : 'border-indigo-500/20 text-gray-300 hover:border-indigo-500/40 active:bg-white/5'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 sm:w-6 sm:h-6 shrink-0 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                            selected ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-600'
                          }`}
                        >
                          {key}
                        </span>
                        <span className="min-w-0 break-words leading-snug">{optionDisplayLabel(opt)}</span>
                      </button>
                    )
                  })}
                </div>
              ) : q.question_type === 'multiple' ? (
                <div className="ml-0 sm:ml-8 lg:ml-10 space-y-3">
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
                    className={examInputCls}
                    placeholder="məs. 134"
                    value={answers[q.id] || ''}
                    onChange={(e) =>
                      setAnswers((p) => ({ ...p, [q.id]: e.target.value.replace(/\D/g, '') }))
                    }
                  />
                </div>
              ) : q.question_type === 'matching' ? (
                <div className="ml-0 sm:ml-8 lg:ml-10 space-y-3">
                  <p className="text-xs text-gray-500">
                    Hər sətir üçün sol rəqəm + sağdakı bütün hərflər bitişik yazın (boşluq yoxdur).
                    <span className="block mt-1">
                      Format nümunəsi:{' '}
                      <span className="font-mono text-indigo-300">
                        {String(q.template_hint || '').trim() || '1a2b3c'}
                      </span>
                      <span className="text-gray-500"> (məs. 1→a, 2→b)</span>
                    </span>
                  </p>
                  <input
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    className={examInputCls}
                    placeholder={`məs. ${String(q.template_hint || '').trim() || '1a2b3c'}`}
                    value={answers[q.id] || ''}
                    onChange={(e) =>
                      setAnswers((p) => ({
                        ...p,
                        [q.id]: e.target.value.toLowerCase().replace(/[^0-9a-z]/g, ''),
                      }))
                    }
                  />
                </div>
              ) : q.question_type === 'sequence' ? (
                <div className="ml-0 sm:ml-8 lg:ml-10 space-y-3">
                  <p className="text-xs text-gray-500">
                    Bəndləri oxuyun və düzgün ardıcıllığı yalnız rəqəmlərlə bitişik yazın (boşluq yoxdur).
                    <span className="block mt-1">
                      Nümunə: <span className="font-mono text-indigo-300">231</span>
                    </span>
                  </p>
                  <div className="rounded-xl border border-indigo-500/15 bg-black/15 p-3 space-y-2">
                    {(Array.isArray(q.options) ? q.options : []).map((opt, oi) => {
                      const text =
                        typeof opt === 'string'
                          ? opt
                          : opt && typeof opt === 'object'
                            ? String(opt.text ?? '')
                            : ''
                      return (
                        <div key={oi} className="flex items-start gap-2 text-sm text-gray-300">
                          <span className="w-6 shrink-0 text-gray-500 font-mono">{oi + 1}.</span>
                          <span className="min-w-0 break-words">{text || '—'}</span>
                        </div>
                      )
                    })}
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className={examInputCls}
                    placeholder="231"
                    value={answers[q.id] || ''}
                    onChange={(e) =>
                      setAnswers((p) => ({ ...p, [q.id]: e.target.value.replace(/\D/g, '').slice(0, 120) }))
                    }
                  />
                </div>
              ) : (
                <textarea
                  className="w-full ml-0 sm:ml-8 lg:ml-10 rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/55 p-3 text-sm text-token-textMain placeholder:text-token-textMuted resize-none outline-none focus:border-primary/40 transition-colors"
                  rows={4}
                  placeholder="Cavabınızı yazın..."
                  value={answers[q.id] || ''}
                  onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                />
              )}
            </Card>
          ))}
            </div>
          </div>
        </div>

        {/* Submit bar */}
        <div className="shrink-0 border-t border-[color:var(--border-subtle)] bg-token-surfaceCard/50 px-3 py-3 sm:px-6 sm:py-4 flex flex-wrap items-center justify-between gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <span className="text-xs sm:text-sm text-token-textMuted min-w-0">
            {Object.keys(answers).length} cavablandı
          </span>
          <Button onClick={submitExam} className="px-5 sm:px-8 shrink-0">
            İmtahanı Bitir →
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 w-full min-w-0 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 pl-20 sm:pl-0">
        <div>
          <h1 className="font-display font-bold text-2xl break-words text-token-textMain">İmtahanlarım</h1>
          {activeEnrollment && (
            <p className="text-sm text-token-textMuted mt-1">
              {activeEnrollment.group_name} • {activeEnrollment.instructor_name}
            </p>
          )}
        </div>
        <GroupSwitcher className="w-full sm:w-auto sm:min-w-[200px]" />
      </div>

      {listError && !listLoading && (
        <Card hover className="p-4 sm:p-5 mb-6 border-red-500/35 bg-red-500/5">
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
        <Card hover className="p-6 mb-6 text-center border-blue-500/40">
          <div className="text-5xl mb-3">{result >= 75 ? '🏆' : result >= 60 ? '🥈' : '📚'}</div>
          <div className="font-display font-extrabold text-4xl bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            {formatScoreBal(result)}
          </div>
          <div className="text-token-textMuted mt-2">Son imtahan nəticəniz</div>
        </Card>
      )}

      <ExamTypeSummaryPanel summary={resultTypeSummary} />

      {resultBreakdown?.length > 0 && (
        <Card hover className="p-6 mb-6 border-indigo-500/30">
          <h2 className="font-display font-bold text-lg text-token-textMain mb-1">Suallar üzrə nəticə</h2>
          <p className="text-xs text-token-textMuted mb-4">Yazdığınız cavabların xülasəsi.</p>
          <ExamBreakdownList rows={resultBreakdown} />
        </Card>
      )}

      {listLoading ? (
        <div className="text-center py-16 text-token-textMuted">İmtahanlar yüklənir…</div>
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
          const inExamWindow = !!(start && until && (inGlobalWindow || inLateWindow))
          const hasOpenAttempt = !!(exam.started_at && !exam.submitted_at)
          /** Təqdim olunmayan cəhd varsa və müəllimin pəncərəsindədirsə — "Davam et" (köhnə şəxsi müddət bitibsə server yeniləyir) */
          const showContinue = hasOpenAttempt && inExamWindow
          const canStartFresh = !hasOpenAttempt && inExamWindow
          const isDone = !!exam.submitted_at

          return (
            <Card
              key={exam.id}
              hover
              className="p-4 sm:p-5 min-w-0 overflow-hidden border border-[color:var(--border-subtle)] hover:border-primary/20"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-display font-bold text-lg mb-2 break-words text-token-textMain">{exam.title}</h3>
                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 text-sm text-token-textMuted">
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className={
                          theme === 'dark'
                            ? [
                                'bg-white/5 hover:bg-white/10 border border-white/10',
                                'text-gray-200 hover:text-white',
                                'disabled:opacity-100 disabled:text-gray-500 disabled:bg-white/[0.03] disabled:border-white/10',
                              ].join(' ')
                            : [
                                '!bg-slate-100 hover:!bg-slate-200 !border !border-slate-200',
                                '!text-slate-900 hover:!text-slate-900',
                                'disabled:opacity-100 disabled:text-slate-400 disabled:bg-slate-50 disabled:border-slate-200',
                              ].join(' ')
                        }
                        onClick={() => openPastReview(exam)}
                      >
                        📋 Nəticəyə bax
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={
                          theme === 'dark'
                            ? [
                                'bg-white/5 hover:bg-white/10 border border-white/10',
                                'text-gray-200 hover:text-white',
                                'disabled:opacity-100 disabled:text-gray-500 disabled:bg-white/[0.03] disabled:border-white/10',
                              ].join(' ')
                            : [
                                '!bg-slate-100 hover:!bg-slate-200 !border !border-slate-200',
                                '!text-slate-900 hover:!text-slate-900',
                                'disabled:opacity-100 disabled:text-slate-400 disabled:bg-slate-50 disabled:border-slate-200',
                              ].join(' ')
                        }
                        onClick={() => void openLeaderboard(exam)}
                      >
                        🏆 Reytinq
                      </Button>
                    </div>
                  ) : !until ? (
                    <span className="text-xs text-amber-400/90 bg-token-surfaceCard/50 border border-[color:var(--border-subtle)] px-3 py-2 rounded-xl inline-block">
                      Müəllim vaxt təyin etməlidir
                    </span>
                  ) : showContinue ? (
                    <Button onClick={() => startExam(exam)}>↩️ Davam et</Button>
                  ) : canStartFresh ? (
                    <Button onClick={() => startExam(exam)}>🚀 Başla</Button>
                  ) : (
                    <span className="text-xs text-token-textMuted bg-token-surfaceCard/50 border border-[color:var(--border-subtle)] px-3 py-2 rounded-xl inline-block">⛔ Aktiv deyil</span>
                  )}
                </div>
              </div>
              {!isDone && until && (
                <div className="mt-3 text-[12px] text-token-textMuted">
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
          <div className="text-center py-16 text-token-textMuted">Sizin üçün imtahan yoxdur</div>
        )}
      </div>
      )}

      <Modal
        open={phonePromptOpen}
        onClose={() => {
          try {
            sessionStorage.setItem('mx_student_phone_prompt_skip', '1')
          } catch {
            /* ignore */
          }
          setPhonePromptOpen(false)
        }}
        title="Mobil nömrə (istəyə bağlı)"
        size="sm"
      >
        <div className="space-y-4 text-sm text-gray-300">
          <p>
            İmtahan xəbərdarlığı əvvəlcə <strong className="text-white">Gmail</strong> ünvanınıza gedir. SMS üçün mobil
            nömrənizi əlavə edə bilərsiniz — müəllim SMS göndərməyi seçəndə istifadə olunur.
          </p>
          <PhoneInput value={contactPhone} onChange={setContactPhone} />
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                try {
                  sessionStorage.setItem('mx_student_phone_prompt_skip', '1')
                } catch {
                  /* ignore */
                }
                setPhonePromptOpen(false)
              }}
            >
              Sonra
            </Button>
            <Button loading={phonePromptBusy} onClick={() => void saveContactPhone()}>
              Saxla
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!accessPrompt}
        onClose={() => {
          setAccessPrompt(null)
          setSearchParams({}, { replace: true })
        }}
        title="İmtahana giriş"
        size="sm"
      >
        {accessPrompt?.exam && (
          <div className="space-y-4">
            <p className="text-sm text-gray-300 leading-relaxed">
              «{accessPrompt.exam.title}» — {accessPrompt.exam.instructor_name || 'müəllim'}
            </p>
            {accessPrompt.pending ? (
              <p className="text-sm text-amber-200/90">
                Müəllimə sorğu göndərilib. Təsdiqlədikdən sonra imtahana daxil ola bilərsiniz və müəllimin tələbəsi
                sayılacaqsınız.
              </p>
            ) : (
              <p className="text-sm text-gray-400">
                İmtahana giriş üçün müəllimin təsdiqi lazımdır.
              </p>
            )}
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => {
                  setAccessPrompt(null)
                  setSearchParams({}, { replace: true })
                }}
              >
                Bağla
              </Button>
              {!accessPrompt.pending && (
                <Button
                  className="w-full sm:w-auto"
                  loading={accessRequestBusy}
                  onClick={() => void submitExamAccessRequest()}
                >
                  Yenidən sorğu göndər
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!startConfirm}
        onClose={() => setStartConfirm(null)}
        title={startConfirm?.mode === 'continue' ? 'İmtahana davam' : 'İmtahana başla'}
        size="sm"
      >
        {startConfirm?.exam && (
          <div className="space-y-4">
            <p className="text-sm text-gray-300 leading-relaxed">
              {startConfirm.mode === 'continue'
                ? 'Yarımçıq imtahana davam etmək istəyirsiniz?'
                : 'İmtahana başlamağa əminsiniz?'}
            </p>
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm">
              <p className="font-semibold text-white break-words">{startConfirm.exam.title}</p>
              <p className="text-gray-400 mt-1">
                Müddət: {Number(startConfirm.exam.duration_minutes) || '—'} dəqiqə
              </p>
            </div>
            <p className="text-xs text-gray-500">
              Başladıqdan sonra vaxt geri sayılır. İnternet bağlantınızın stabil olduğundan əmin olun.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
              <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setStartConfirm(null)}>
                Xeyr
              </Button>
              <Button
                className="w-full sm:w-auto"
                onClick={() => {
                  const ex = startConfirm.exam
                  setStartConfirm(null)
                  void startExam(ex)
                }}
              >
                Bəli, başla
              </Button>
            </div>
          </div>
        )}
      </Modal>

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
            <ExamTypeSummaryPanel summary={reviewModal.type_summary} />
            {reviewModal.breakdown?.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-token-textMain mb-2">Suallar üzrə</h3>
                <ExamBreakdownList rows={reviewModal.breakdown} />
              </div>
            )}

            {Array.isArray(reviewModal.exam_files) && reviewModal.exam_files.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-bold text-white mb-2">İmtahan sualları</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Suallar bu imtahana əlavə edilmiş fayllardır. Şəkilləri böyütmək üçün üzərinə klikləyin.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {reviewModal.exam_files.map((f) => {
                    const openUrl = materialOpenInNewTabUrl(f.url, reviewModal?.exam_id || null)
                    return (
                      <a
                        key={f.id || f.url}
                        href={openUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-indigo-500/15 bg-black/20 overflow-hidden hover:border-primary/30 transition-colors"
                      >
                        <div className="px-3 py-2 text-xs text-gray-400 border-b border-indigo-500/10 truncate">
                          {f.name || 'Fayl'}
                        </div>
                        <div className="p-2">
                          <img
                            src={openUrl}
                            alt={f.name || 'İmtahan faylı'}
                            className="w-full h-[280px] sm:h-[320px] object-contain bg-black/30 rounded-lg"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      </a>
                    )
                  })}
                </div>
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
            <div className="rounded-xl border border-indigo-400/35 bg-indigo-500/10 px-4 py-3">
              <p className="text-sm text-indigo-50">
                <span className="font-bold text-white">Sizin Qrupunuz:</span>{' '}
                <span className="text-cyan-200 font-semibold">{leaderModal.grade || '—'}</span>
              </p>
              <p className="text-[11px] text-gray-400 mt-1.5 leading-snug">
                Bu siyahı yalnız öz qrupunuzdakı tələbələrin nəticələridir; digər qruplar göstərilmir.
              </p>
            </div>
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
                        <div className="text-sm font-extrabold text-white">
                          {r.score_pct != null && Number.isFinite(Number(r.score_pct))
                            ? `${Math.min(100, Math.max(0, Math.round(Number(r.score_pct))))}%`
                            : formatScoreBal(r.score)}
                        </div>
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
