import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Brand from '../../components/common/Brand'
import PublicSeoFooter from '../../components/public/PublicSeoFooter'
import LevelBadge from '../../components/public/LevelBadge'
import CertifiedExamAuthGate from '../../components/public/CertifiedExamAuthGate'
import api from '../../lib/api'
import { setPageSeo, SITE_ORIGIN } from '../../lib/pageSeo'
import useAuthStore from '../../hooks/useAuth'
import { useToast } from '../../components/common/Toast'

export default function CertifiedExamDetailPage() {
  const { categorySlug, examSlug } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuthStore()
  const { t, i18n } = useTranslation()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [gateOpen, setGateOpen] = useState(false)

  const load = useCallback(async () => {
    if (!categorySlug || !examSlug) return
    setLoading(true)
    try {
      const d = await api.get(
        `/public/certified-exams/${encodeURIComponent(categorySlug)}/${encodeURIComponent(examSlug)}`,
      )
      setData(d)
      const exam = d?.exam
      const pass = exam?.pass_pct ?? 70
      setPageSeo({
        title: `${exam?.title || 'İmtahan'} — Sertifikatlı İmtahan | Mentorix`,
        description: exam?.title
          ? `${exam.title} imtahanını ver, keçid balını topla, QR kodu ilə doğrulanan sertifikat qazan. Keçid balı: ${pass}%`
          : t('certifiedExams.seo.examDescription'),
        canonicalPath: exam?.share_path || `/sertifikatli-imtahanlar/${categorySlug}/${examSlug}`,
        ogImage: `${SITE_ORIGIN}/og.svg?v=5`,
      })
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [categorySlug, examSlug, t, i18n.language])

  useEffect(() => {
    void load()
  }, [load])

  const exam = data?.exam
  const category = data?.category

  const startExam = () => {
    if (!exam?.id) return
    if (user?.role === 'student') {
      navigate(`/exam/${encodeURIComponent(exam.id)}`)
      return
    }
    if (user?.role) {
      toast(t('certifiedExams.studentsOnly'), 'error')
      return
    }
    setGateOpen(true)
  }

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-gray-100 flex flex-col">
      <header className="border-b border-white/10 bg-[#0b0b0b]/95 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0">
            <Brand compact />
          </Link>
          <Link
            to={`/sertifikatli-imtahanlar/${encodeURIComponent(categorySlug || '')}`}
            className="text-sm text-primary hover:underline"
          >
            {t('certifiedExams.backToCategory')}
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8 space-y-6">
        {loading ? (
          <p className="text-sm text-gray-500">{t('certifiedExams.loading')}</p>
        ) : !exam ? (
          <p className="text-sm text-red-300">{t('certifiedExams.examNotFound')}</p>
        ) : (
          <>
            <div className="space-y-3">
              {category?.name ? (
                <p className="text-xs uppercase tracking-wider text-gray-500">
                  {category.icon ? `${category.icon} ` : ''}
                  {category.name}
                </p>
              ) : null}
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-2xl font-semibold text-white leading-snug">{exam.title}</h1>
                <LevelBadge level={exam.level} />
              </div>
              {exam.description ? <p className="text-sm text-gray-400">{exam.description}</p> : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#121212]/80 p-5 space-y-4">
              <p className="text-sm text-gray-300">
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
                onClick={startExam}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-[#041018] hover:opacity-90"
              >
                {t('certifiedExams.startExam')}
              </button>
            </div>
          </>
        )}
      </main>

      <PublicSeoFooter />
      <CertifiedExamAuthGate open={gateOpen} exam={exam} onClose={() => setGateOpen(false)} />
    </div>
  )
}
