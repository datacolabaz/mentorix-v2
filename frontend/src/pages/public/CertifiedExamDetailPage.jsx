import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PublicMarketingNav from '../../components/public/PublicMarketingNav'
import PublicSeoFooter from '../../components/public/PublicSeoFooter'
import LevelBadge from '../../components/public/LevelBadge'
import CertifiedExamAuthGate from '../../components/public/CertifiedExamAuthGate'
import api from '../../lib/api'
import { CERTIFIED_OG_IMAGE, setPageSeo } from '../../lib/pageSeo'
import { buildCertifiedExamShareUrl, copyCertifiedExamShareUrl } from '../../lib/certifiedExamShareUrl'
import useAuthStore from '../../hooks/useAuth'
import useUiStore from '../../hooks/useUi'
import { useToast } from '../../components/common/Toast'

export default function CertifiedExamDetailPage() {
  const { categorySlug, examSlug } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuthStore()
  const theme = useUiStore((s) => s.theme)
  const isDark = theme === 'dark'
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
        ogImage: CERTIFIED_OG_IMAGE,
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

  const shareUrl = buildCertifiedExamShareUrl(categorySlug, examSlug)

  const copyShareLink = async () => {
    try {
      await copyCertifiedExamShareUrl(categorySlug, examSlug)
      toast(t('certifiedExams.copyShareLinkSuccess'), 'success')
    } catch {
      toast(t('certifiedExams.copyShareLinkError'), 'error')
    }
  }

  return (
    <div className={`mx-public-page theme-${theme} min-h-screen flex flex-col ${isDark ? 'bg-[#0b0b0b] text-gray-100' : 'bg-[#f4f6fb] text-slate-900'}`}>
      <PublicMarketingNav />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8 space-y-6">
        {loading ? (
          <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-slate-500'}`}>{t('certifiedExams.loading')}</p>
        ) : !exam ? (
          <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-600'}`}>{t('certifiedExams.examNotFound')}</p>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Link
                  to={`/sertifikatli-imtahanlar/${encodeURIComponent(categorySlug || '')}`}
                  className="text-xs text-primary font-semibold hover:underline"
                >
                  {t('certifiedExams.backToCategory')}
                </Link>
              </div>
              {category?.name ? (
                <p className={`text-xs uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-slate-500'}`}>
                  {category.icon ? `${category.icon} ` : ''}
                  {category.name}
                </p>
              ) : null}
              <div className="flex items-start justify-between gap-3">
                <h1 className={`text-2xl font-semibold leading-snug ${isDark ? 'text-white' : 'text-slate-900'}`}>{exam.title}</h1>
                <LevelBadge level={exam.level} />
              </div>
              {exam.description ? (
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>{exam.description}</p>
              ) : null}
            </div>

            <div className={`rounded-2xl border p-5 space-y-4 ${isDark ? 'border-white/10 bg-[#121212]/80' : 'border-slate-200 bg-white shadow-sm'}`}>
              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                {t('certifiedExams.examMeta', {
                  questions: exam.question_count,
                  minutes: exam.duration_minutes,
                  pass: exam.pass_pct,
                })}
              </p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                {t('certifiedExams.instructor')}: {exam.instructor_name}
              </p>
              {shareUrl ? (
                <div className={`rounded-xl border px-3 py-2 space-y-2 ${isDark ? 'border-white/10 bg-[#0f0f0f]' : 'border-slate-200 bg-slate-50'}`}>
                  <p className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-slate-500'}`}>{t('certifiedExams.shareLinkLabel')}</p>
                  <p className={`text-xs break-all ${isDark ? 'text-gray-300' : 'text-slate-800'}`}>{shareUrl}</p>
                  <button
                    type="button"
                    onClick={copyShareLink}
                    className={`w-full rounded-lg border px-3 py-2 text-xs font-semibold ${
                      isDark
                        ? 'border-white/15 text-gray-300 hover:border-primary/35 hover:text-primary'
                        : 'border-slate-300 text-slate-700 hover:border-primary/50 hover:text-primary'
                    }`}
                  >
                    {t('certifiedExams.copyShareLink')}
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                onClick={startExam}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-[#041018] hover:opacity-90 transition-opacity"
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
