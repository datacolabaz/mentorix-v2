import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PublicPageTopBar from '../../components/public/PublicPageTopBar'
import PublicSeoFooter from '../../components/public/PublicSeoFooter'
import api from '../../lib/api'
import { setPageSeo } from '../../lib/pageSeo'
import useUiStore from '../../hooks/useUi'

export default function CertifiedExamsCatalog() {
  const { t, i18n } = useTranslation()
  const theme = useUiStore((s) => s.theme)
  const isDark = theme === 'dark'
  const [categories, setCategories] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setPageSeo({
      title: t('certifiedExams.seo.catalogTitle'),
      description: t('certifiedExams.seo.catalogDescription'),
      canonicalPath: '/sertifikatli-imtahanlar',
      keywords: 'sertifikatlı imtahan, skill assessment, IELTS, Python, Data Analytics, Mentorix',
      breadcrumbs: [
        { name: 'Mentorix', path: '/' },
        { name: t('certifiedExams.seo.breadcrumb'), path: '/sertifikatli-imtahanlar' },
      ],
    })
  }, [t, i18n.language])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [cats, st] = await Promise.all([
          api.get('/public/certified-exams/categories'),
          api.get('/public/certified-exams/stats'),
        ])
        if (!cancelled) {
          setCategories(Array.isArray(cats?.categories) ? cats.categories : [])
          setStats(st?.stats || null)
        }
      } catch {
        if (!cancelled) setCategories([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [i18n.language])

  const assessmentLabel = (count) =>
    count === 1 ? t('certifiedExams.assessmentOne', { count }) : t('certifiedExams.assessmentOther', { count })

  return (
    <div className={`mx-public-page theme-${theme} min-h-screen flex flex-col bg-token-surfaceMain text-token-textMain`}>
      <PublicPageTopBar
        backTo="/"
        title={t('certifiedExams.catalogTitle')}
        subtitle={t('certifiedExams.catalogDescription')}
        compactOnMobile
      />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 sm:py-10 space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
            <span aria-hidden>🎓</span> {t('certifiedExams.catalogBadge')}
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-token-textMain">
            {t('certifiedExams.catalogTitle')}
          </h1>
          <p className="text-sm max-w-2xl text-token-textMuted">
            {t('certifiedExams.catalogDescription')}
          </p>
          {stats ? (
            <p className="text-xs text-token-textMuted opacity-80">
              {t('certifiedExams.statsLine', {
                certificates: stats.certificates_issued,
                exams: stats.verified_exam_types,
              })}
            </p>
          ) : null}
        </div>

        {loading ? (
          <p className="text-sm text-token-textMuted">{t('certifiedExams.loading')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/sertifikatli-imtahanlar/${encodeURIComponent(cat.slug)}`}
                className="group rounded-2xl border border-[color:var(--border-subtle)] bg-token-surfaceCard p-5 transition hover:border-primary/50 hover:shadow-md"
              >
                <div className="text-3xl mb-3" aria-hidden>
                  {cat.icon || '📚'}
                </div>
                <h2 className="text-base font-semibold group-hover:text-primary transition-colors text-token-textMain">
                  {t(`certifiedExams.categories.${cat.slug}`, { defaultValue: cat.name })}
                </h2>
                <p className="text-sm text-primary/90 mt-2 tabular-nums">{assessmentLabel(cat.assessment_count)}</p>
                {cat.description ? (
                  <p className="text-[11px] mt-2 line-clamp-2 text-token-textMuted">{cat.description}</p>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </main>

      <PublicSeoFooter />
    </div>
  )
}
