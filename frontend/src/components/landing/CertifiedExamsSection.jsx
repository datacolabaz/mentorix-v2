import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { trackEvent } from '../../lib/analytics'
import CertificatePreviewMockup from './CertificatePreviewMockup'

/** Landing-də ilk baxışda göstərilən populyar kateqoriyalar (sıra = vurğu). */
const FEATURED_CATEGORY_SLUGS = [
  'beynelxalq-imtahanlar',
  'it-proqramlasdirma',
  'data-analytics',
  'cloud-devops',
]
const FEATURED_LIMIT = 4

const CARD_CLASS =
  'group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left hover:border-emerald-300 hover:bg-emerald-50/60 transition'

export function splitLandingCategories(categories, featuredSlugs = FEATURED_CATEGORY_SLUGS, limit = FEATURED_LIMIT) {
  const list = Array.isArray(categories) ? categories : []
  const bySlug = new Map(list.map((c) => [c.slug, c]))
  const featured = []
  const used = new Set()
  for (const slug of featuredSlugs) {
    if (featured.length >= limit) break
    const cat = bySlug.get(slug)
    if (!cat) continue
    featured.push(cat)
    used.add(cat.id ?? cat.slug)
  }
  const leftover = list.filter((c) => !used.has(c.id ?? c.slug))
  const byCount = leftover
    .slice()
    .sort((a, b) => (Number(b.assessment_count) || 0) - (Number(a.assessment_count) || 0))
  for (const cat of byCount) {
    if (featured.length >= limit) break
    featured.push(cat)
    used.add(cat.id ?? cat.slug)
  }
  const rest = list.filter((c) => !used.has(c.id ?? c.slug))
  return { featured, rest }
}

function CategoryRow({ cat, t, assessmentLabel, onNavigate }) {
  return (
    <Link
      to={`/sertifikatli-imtahanlar/${encodeURIComponent(cat.slug)}`}
      onClick={() => {
        trackEvent('mx_landing_certified_category', { slug: cat.slug })
        if (onNavigate) onNavigate()
      }}
      className={CARD_CLASS}
    >
      <span className="text-lg w-7 shrink-0 text-center" aria-hidden>
        {cat.icon || '📚'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-900 leading-snug group-hover:text-emerald-700 transition-colors">
          {t(`certifiedExams.categories.${cat.slug}`, { defaultValue: cat.name })}
        </span>
        <span className="block text-[11px] text-slate-500 mt-0.5 tabular-nums">{assessmentLabel(cat.assessment_count)}</span>
      </span>
    </Link>
  )
}

export default function CertifiedExamsSection({ onHowItWorks }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [stats, setStats] = useState({ certificates_issued: 0, verified_exam_types: 0 })
  const [sampleOpen, setSampleOpen] = useState(false)
  const [sampleEntered, setSampleEntered] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [moreEntered, setMoreEntered] = useState(false)

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

  const { featured, rest } = useMemo(() => splitLandingCategories(categories), [categories])

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

  useEffect(() => {
    if (!moreOpen) return undefined
    const id = window.requestAnimationFrame(() => setMoreEntered(true))
    const onKey = (e) => {
      if (e.key === 'Escape') closeMore()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.cancelAnimationFrame(id)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [moreOpen])

  const openSample = () => {
    trackEvent('mx_landing_certified_cta', { action: 'view_sample' })
    setMoreOpen(false)
    setMoreEntered(false)
    setSampleOpen(true)
  }

  const closeSample = () => {
    setSampleEntered(false)
    window.setTimeout(() => setSampleOpen(false), 220)
  }

  const openMore = () => {
    trackEvent('mx_landing_certified_cta', { action: 'more_categories' })
    setSampleOpen(false)
    setSampleEntered(false)
    setMoreOpen(true)
  }

  const closeMore = () => {
    setMoreEntered(false)
    window.setTimeout(() => setMoreOpen(false), 180)
  }

  const assessmentLabel = (count) =>
    count === 1 ? t('certifiedExams.assessmentOne', { count }) : t('certifiedExams.assessmentOther', { count })

  return (
    <section
      id="mx-certified-exams"
      className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white px-6 py-8 sm:px-10 sm:py-10 shadow-sm"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
          <span aria-hidden>🎓</span>
          {t('certifiedExams.badge')}
        </div>
        <button
          type="button"
          onClick={openSample}
          className="inline-flex items-center gap-2 shrink-0 max-w-[70%] sm:max-w-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 min-h-[40px] text-xs sm:text-sm font-semibold text-slate-800 hover:bg-white"
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

      <div className="mt-8 max-w-2xl space-y-3">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">{t('certifiedExams.title')}</h2>
        <p className="text-base text-slate-600 leading-relaxed">{t('certifiedExams.description')}</p>
      </div>

      {featured.length > 0 ? (
        <div className="mt-8 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {featured.map((cat) => (
              <CategoryRow key={cat.id ?? cat.slug} cat={cat} t={t} assessmentLabel={assessmentLabel} />
            ))}
          </div>
          {rest.length > 0 ? (
            <button
              type="button"
              onClick={openMore}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:brightness-110"
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
            >
              {t('certifiedExams.moreCategories')}
              <span aria-hidden>→</span>
            </button>
          ) : null}
          {stats.certificates_issued > 0 || stats.verified_exam_types > 0 ? (
            <p className="text-xs text-gray-500">
              {t('certifiedExams.statsLine', {
                certificates: stats.certificates_issued,
                exams: stats.verified_exam_types,
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 flex flex-col sm:flex-row gap-2 sm:gap-3">
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
          className="inline-flex justify-center items-center rounded-xl border border-slate-200 bg-white px-5 py-3 min-h-[48px] text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          {t('certifiedExams.ctaHowItWorks')}
        </button>
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

      {moreOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mx-certified-more-title"
        >
          <button
            type="button"
            className={`absolute inset-0 bg-black/70 transition-opacity duration-200 ${moreEntered ? 'opacity-100' : 'opacity-0'}`}
            aria-label={t('certifiedExams.closeSample')}
            onClick={closeMore}
          />
          <div
            className={`relative w-full max-w-md rounded-2xl border border-white/10 bg-[#111] p-5 sm:p-6 shadow-2xl transition duration-200 ${
              moreEntered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 id="mx-certified-more-title" className="text-base font-semibold text-white">
                {t('certifiedExams.moreCategoriesTitle')}
              </h3>
              <button
                type="button"
                onClick={closeMore}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 hover:text-white"
                aria-label={t('certifiedExams.closeSample')}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-0.5">
              {rest.map((cat) => (
                <CategoryRow
                  key={cat.id ?? cat.slug}
                  cat={cat}
                  t={t}
                  assessmentLabel={assessmentLabel}
                  onNavigate={closeMore}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
