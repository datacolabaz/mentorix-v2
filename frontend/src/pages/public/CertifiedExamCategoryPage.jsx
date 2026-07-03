import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Brand from '../../components/common/Brand'
import PublicSeoFooter from '../../components/public/PublicSeoFooter'
import LevelBadge from '../../components/public/LevelBadge'
import CertifiedExamAuthGate from '../../components/public/CertifiedExamAuthGate'
import api from '../../lib/api'
import { setPageSeo } from '../../lib/pageSeo'
import useAuthStore from '../../hooks/useAuth'
import { useToast } from '../../components/common/Toast'

function ExamCard({ exam, onStart, t }) {
  return (
    <article className="rounded-xl border border-white/10 bg-black/25 p-4 space-y-2 hover:border-primary/25 transition">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-white leading-snug">{exam.title}</h3>
        <LevelBadge level={exam.level} />
      </div>
      <p className="text-xs text-gray-500">
        {t('certifiedExams.examMeta', {
          questions: exam.question_count,
          minutes: exam.duration_minutes,
          pass: exam.pass_pct,
        })}
      </p>
      <p className="text-xs text-gray-400">
        {t('certifiedExams.instructor')}: {exam.instructor_name}
      </p>
      <button
        type="button"
        onClick={() => onStart(exam)}
        className="w-full rounded-lg bg-primary/15 border border-primary/35 text-primary px-3 py-2 text-xs font-bold hover:bg-primary/25"
      >
        {t('certifiedExams.startExam')}
      </button>
    </article>
  )
}

function CareerPathTimeline({ path, onOpen, t }) {
  const { i18n } = useTranslation()
  const [steps, setSteps] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const d = await api.get(`/public/certified-exams/career-paths/${encodeURIComponent(path.slug)}`)
        if (!cancelled) setSteps(Array.isArray(d?.steps) ? d.steps : [])
      } catch {
        if (!cancelled) setSteps([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [path.slug, i18n.language])

  const statusIcon = { completed: '✅', ready: '🔓', locked: '🔒' }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#121212]/80 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>
          {path.icon || '🛤️'}
        </span>
        <div>
          <h3 className="text-base font-semibold text-white">{path.name}</h3>
          {path.description ? <p className="text-xs text-gray-400 mt-1">{path.description}</p> : null}
        </div>
      </div>
      {loading ? (
        <p className="text-xs text-gray-500">{t('certifiedExams.loading')}</p>
      ) : (
        <ol className="space-y-0 border-l border-primary/25 ml-3 pl-4">
          {steps.map((step) => (
            <li key={step.id} className="relative pb-4 last:pb-0">
              <span className="absolute -left-[1.35rem] top-0.5 text-sm" aria-hidden>
                {statusIcon[step.status] || '🔒'}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-white">{step.title}</span>
                <LevelBadge level={step.level} />
              </div>
              {step.status !== 'locked' ? (
                <button
                  type="button"
                  onClick={() =>
                    onOpen({
                      id: step.exam_id,
                      title: step.title,
                      question_count: 0,
                      duration_minutes: step.duration_minutes,
                      pass_pct: step.pass_pct,
                      instructor_name: 'Mentorix',
                    })
                  }
                  className="mt-2 text-xs font-semibold text-primary hover:underline"
                >
                  {t('certifiedExams.startStep')}
                </button>
              ) : (
                <p className="text-[10px] text-gray-500 mt-1">{t('certifiedExams.completePreviousSteps')}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export default function CertifiedExamCategoryPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuthStore()
  const { t, i18n } = useTranslation()
  const [tab, setTab] = useState('exams')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [gateExam, setGateExam] = useState(null)
  const [waitEmail, setWaitEmail] = useState('')
  const [waitBusy, setWaitBusy] = useState(false)

  const load = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    try {
      const d = await api.get(`/public/certified-exams/categories/${encodeURIComponent(slug)}`)
      setData(d)
      setPageSeo({
        title: t('certifiedExams.seo.categoryTitle', { name: d?.category?.name || 'Kateqoriya' }),
        description: d?.category?.description || t('certifiedExams.seo.categoryDescription'),
        canonicalPath: `/sertifikatli-imtahanlar/${slug}`,
      })
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [slug, t, i18n.language])

  useEffect(() => {
    void load()
  }, [load])

  const totalExams = (data?.child_groups || []).reduce((n, g) => n + (g.exams?.length || 0), 0)

  const startExam = (exam) => {
    if (user?.role === 'student') {
      navigate(`/exam/${encodeURIComponent(exam.id)}`)
      return
    }
    if (user?.role) {
      toast(t('certifiedExams.studentsOnly'), 'error')
      return
    }
    setGateExam(exam)
  }

  const submitWaitlist = async (e) => {
    e.preventDefault()
    setWaitBusy(true)
    try {
      const d = await api.post('/public/certified-exams/waitlist', { email: waitEmail.trim(), category_slug: slug })
      toast(d?.message || 'OK', 'success')
      setWaitEmail('')
    } catch (err) {
      toast(err?.message || 'Xəta', 'error')
    } finally {
      setWaitBusy(false)
    }
  }

  const category = data?.category

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-gray-100 flex flex-col">
      <header className="border-b border-white/10 bg-[#0b0b0b]/95 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0">
            <Brand compact />
          </Link>
          <Link to="/sertifikatli-imtahanlar" className="text-sm text-primary hover:underline">
            {t('certifiedExams.backToCatalog')}
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 space-y-6">
        {loading ? (
          <p className="text-sm text-gray-500">{t('certifiedExams.loading')}</p>
        ) : !category ? (
          <p className="text-sm text-red-300">{t('certifiedExams.categoryNotFound')}</p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="text-3xl" aria-hidden>
                {category.icon || '📚'}
              </div>
              <h1 className="text-2xl font-semibold text-white">{category.name}</h1>
              {category.description ? <p className="text-sm text-gray-400">{category.description}</p> : null}
            </div>

            <div className="flex gap-2 border-b border-white/10 pb-2">
              <button
                type="button"
                onClick={() => setTab('exams')}
                className={[
                  'px-4 py-2 text-sm font-semibold rounded-t-lg',
                  tab === 'exams' ? 'text-primary border-b-2 border-primary' : 'text-gray-400',
                ].join(' ')}
              >
                {t('certifiedExams.tabExams')}
              </button>
              <button
                type="button"
                onClick={() => setTab('paths')}
                className={[
                  'px-4 py-2 text-sm font-semibold rounded-t-lg',
                  tab === 'paths' ? 'text-primary border-b-2 border-primary' : 'text-gray-400',
                ].join(' ')}
              >
                {t('certifiedExams.tabPaths')}
              </button>
            </div>

            {tab === 'exams' ? (
              totalExams === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-[#121212]/90 p-6 space-y-3 max-w-lg">
                  <p className="text-sm text-gray-300">{t('certifiedExams.comingSoonExams')}</p>
                  <form onSubmit={submitWaitlist} className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      required
                      value={waitEmail}
                      onChange={(e) => setWaitEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="flex-1 rounded-xl bg-[#0f0f0f] border border-white/10 px-3 py-2 text-sm"
                    />
                    <button type="submit" disabled={waitBusy} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-[#041018]">
                      {t('certifiedExams.waitlistNotify')}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-8">
                  {(data.child_groups || []).map((group) =>
                    group.exams?.length ? (
                      <section key={group.id} className="space-y-3">
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">{group.name}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {group.exams.map((exam) => (
                            <ExamCard key={exam.id} exam={exam} onStart={startExam} t={t} />
                          ))}
                        </div>
                      </section>
                    ) : null,
                  )}
                </div>
              )
            ) : (data.career_paths || []).length === 0 ? (
              <p className="text-sm text-gray-500">{t('certifiedExams.comingSoonPaths')}</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {(data.career_paths || []).map((path) => (
                  <CareerPathTimeline key={path.id} path={path} onOpen={startExam} t={t} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <PublicSeoFooter />
      <CertifiedExamAuthGate open={Boolean(gateExam)} exam={gateExam} onClose={() => setGateExam(null)} />
    </div>
  )
}
