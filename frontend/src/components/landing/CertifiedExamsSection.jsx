import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { trackEvent } from '../../lib/analytics'
import CertificatePreviewMockup from './CertificatePreviewMockup'
import { ArrowRightIcon, BadgeCheckIcon } from './icons'
import { BRAND } from '../../lib/brand'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface'

/** Landing-də ilk baxışda göstərilən populyar kateqoriyalar (sıra = vurğu). */
const FEATURED_CATEGORY_SLUGS = [
  'beynelxalq-imtahanlar',
  'it-proqramlasdirma',
  'data-analytics',
  'cloud-devops',
]
const FEATURED_LIMIT = 4

const CARD_CLASS = `group flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 text-left transition-colors hover:border-line-strong hover:bg-canvas-subtle ${FOCUS}`

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
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand-text">
        <BadgeCheckIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body-sm font-semibold leading-snug text-fg">
          {t(`certifiedExams.categories.${cat.slug}`, { defaultValue: cat.name })}
        </span>
        <span className="mt-0.5 block text-caption tabular-nums text-fg-muted">{assessmentLabel(cat.assessment_count)}</span>
      </span>
      <ArrowRightIcon className="h-4 w-4 shrink-0 text-fg-muted transition-transform group-hover:translate-x-0.5" />
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
      aria-labelledby="mx-certified-title"
      className="scroll-mt-24 rounded-2xl border border-line bg-surface px-6 py-8 shadow-card sm:px-10 sm:py-10"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="inline-flex items-center gap-2 rounded-full bg-brand-subtle px-3 py-1 text-caption font-semibold text-brand-text">
          <BadgeCheckIcon className="h-4 w-4" />
          {t('certifiedExams.badge')}
        </p>
        <button
          type="button"
          onClick={openSample}
          className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-body-sm font-semibold text-fg hover:bg-canvas-subtle ${FOCUS}`}
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
        <h2 id="mx-certified-title" className="text-h2 text-fg">
          {t('certifiedExams.title')}
        </h2>
        <p className="text-body-lg text-fg-secondary">{t('certifiedExams.description')}</p>
        <p className="text-body-sm text-fg-muted">{t('home.certified.disclaimer', { brand: BRAND.name })}</p>
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
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-sm text-body-sm font-semibold text-brand-text underline-offset-4 hover:underline ${FOCUS}`}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
            >
              {t('certifiedExams.moreCategories')}
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          ) : null}
          {stats.certificates_issued > 0 || stats.verified_exam_types > 0 ? (
            <p className="text-caption text-fg-muted">
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
          className={`inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-5 text-button text-brand-on shadow-card hover:bg-brand-hover ${FOCUS}`}
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
          className={`inline-flex min-h-12 items-center justify-center rounded-xl border border-line-strong bg-surface px-5 text-button text-fg hover:bg-canvas-subtle ${FOCUS}`}
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
            className={`absolute inset-y-0 right-0 w-full max-w-sm sm:max-w-md overflow-y-auto border-l border-white/10 bg-surface-1 p-5 sm:p-6 shadow-2xl transition-transform duration-300 ease-out ${
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
            className={`relative w-full max-w-md rounded-2xl border border-line bg-surface-elevated p-5 text-fg shadow-elevated transition duration-200 sm:p-6 ${
              moreEntered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 id="mx-certified-more-title" className="text-h3 text-fg">
                {t('certifiedExams.moreCategoriesTitle')}
              </h3>
              <button
                type="button"
                onClick={closeMore}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line text-fg-secondary hover:bg-canvas-subtle hover:text-fg ${FOCUS}`}
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
