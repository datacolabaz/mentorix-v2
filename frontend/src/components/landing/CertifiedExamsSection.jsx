import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { trackEvent } from '../../lib/analytics'
import CertificatePreviewMockup from './CertificatePreviewMockup'

export default function CertifiedExamsSection({ onHowItWorks }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [stats, setStats] = useState({ certificates_issued: 0, verified_exam_types: 0 })
  const [sampleOpen, setSampleOpen] = useState(false)
  const [sampleEntered, setSampleEntered] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [cats, st] = await Promise.all([
          api.get('/public/certified-exams/categories'),
          api.get('/public/certified-exams/stats'),
        ])
        if (!cancelled) {
          setCategories(Array.isArray(cats?.categories) ? cats.categories : [])
          if (st?.stats) setStats(st.stats)
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [i18n.language])

  useEffect(() => {
    if (!sampleOpen) return undefined
    const id = window.requestAnimationFrame(() => setSampleEntered(true))
    const onKey = (e) => {
      if (e.key === 'Escape') closeSample()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.cancelAnimationFrame(id)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [sampleOpen])

  const openSample = () => {
    trackEvent('mx_landing_certified_cta', { action: 'view_sample' })
    setSampleOpen(true)
  }

  const closeSample = () => {
    setSampleEntered(false)
    window.setTimeout(() => setSampleOpen(false), 220)
  }

  const assessmentLabel = (count) =>
    count === 1 ? t('certifiedExams.assessmentOne', { count }) : t('certifiedExams.assessmentOther', { count })

  return (
    <section
      id="mx-certified-exams"
      className="scroll-mt-24 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-[#0e1412] to-[#0b0b0b] p-6 sm:p-8 space-y-6"
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
            <span aria-hidden>🎓</span>
            {t('certifiedExams.badge')}
          </div>
          <button
            type="button"
            onClick={openSample}
            className="inline-flex items-center gap-2 shrink-0 max-w-[70%] sm:max-w-none rounded-xl border border-white/15 bg-white/5 px-3 py-2 min-h-[40px] text-xs sm:text-sm font-semibold text-gray-100 hover:bg-white/10"
            aria-haspopup="dialog"
            aria-expanded={sampleOpen}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="text-left leading-tight">{t('certifiedExams.viewSample')}</span>
          </button>
        </div>

        <h2 className="text-xl sm:text-2xl font-semibold text-white leading-tight">{t('certifiedExams.title')}</h2>
        <p className="text-sm text-gray-400 leading-relaxed max-w-3xl">{t('certifiedExams.description')}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/sertifikatli-imtahanlar/${encodeURIComponent(cat.slug)}`}
              onClick={() => trackEvent('mx_landing_certified_category', { slug: cat.slug })}
              className="text-left rounded-xl border border-white/10 bg-black/20 p-4 hover:border-primary/40 hover:bg-primary/5 hover:shadow-[0_0_24px_-8px_rgba(0,229,176,0.3)] transition"
            >
              <div className="text-2xl mb-2" aria-hidden>
                {cat.icon}
              </div>
              <p className="text-sm font-semibold text-white">
                {t(`certifiedExams.categories.${cat.slug}`, { defaultValue: cat.name })}
              </p>
              <p className="text-[11px] text-primary/90 mt-1 tabular-nums">{assessmentLabel(cat.assessment_count)}</p>
            </Link>
          ))}
        </div>

        {stats.certificates_issued > 0 || stats.verified_exam_types > 0 ? (
          <div className="grid grid-cols-2 gap-2 max-w-md">
            {stats.certificates_issued > 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5">
                <div className="text-lg font-semibold text-white tabular-nums">{stats.certificates_issued}</div>
                <div className="text-[10px] text-gray-500">{t('certifiedExams.statsCertificates')}</div>
              </div>
            ) : null}
            {stats.verified_exam_types > 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5">
                <div className="text-lg font-semibold text-primary tabular-nums">{stats.verified_exam_types}</div>
                <div className="text-[10px] text-gray-500">{t('certifiedExams.statsActive')}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-1">
          <Link
            to="/sertifikatli-imtahanlar"
            onClick={() => trackEvent('mx_landing_certified_cta', { action: 'catalog' })}
            className="inline-flex justify-center items-center rounded-xl bg-primary px-5 py-3 min-h-[48px] text-sm font-bold text-[#041018] shadow-lg shadow-primary/25 hover:brightness-95"
          >
            {t('certifiedExams.ctaCatalog')}
          </Link>
          <button
            type="button"
            onClick={() => {
              trackEvent('mx_landing_certified_cta', { action: 'how_it_works' })
              if (onHowItWorks) onHowItWorks()
              else navigate('/sertifikatli-imtahanlar')
            }}
            className="inline-flex justify-center items-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 min-h-[48px] text-sm font-semibold text-gray-100 hover:bg-white/10"
          >
            {t('certifiedExams.ctaHowItWorks')}
          </button>
        </div>
      </div>

      {sampleOpen ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t('certifiedExams.sampleDialogLabel')}>
          <button
            type="button"
            className={`absolute inset-0 bg-black/70 transition-opacity duration-200 ${sampleEntered ? 'opacity-100' : 'opacity-0'}`}
            aria-label={t('certifiedExams.closeSample')}
            onClick={closeSample}
          />
          <aside
            className={`absolute inset-y-0 right-0 w-full max-w-sm sm:max-w-md overflow-y-auto border-l border-white/10 bg-[#0b0b0b] p-5 sm:p-6 shadow-2xl transition-transform duration-300 ease-out ${
              sampleEntered ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {t('certifiedExams.sampleDialogLabel')}
              </p>
              <button
                type="button"
                onClick={closeSample}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 hover:text-white"
                aria-label={t('certifiedExams.closeSample')}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <CertificatePreviewMockup />
          </aside>
        </div>
      ) : null}
    </section>
  )
}
