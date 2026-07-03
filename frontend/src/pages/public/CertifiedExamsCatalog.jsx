import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Brand from '../../components/common/Brand'
import PublicSeoFooter from '../../components/public/PublicSeoFooter'
import api from '../../lib/api'
import { setPageSeo } from '../../lib/pageSeo'

export default function CertifiedExamsCatalog() {
  const [categories, setCategories] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setPageSeo({
      title: 'Sertifikatlı imtahanlar — Mentorix',
      description: 'Beynəlxalq, IT, Data Analytics, Cloud, Cyber Security və digər sahələrdə sertifikatlı skill assessment kataloqu.',
      canonicalPath: '/sertifikatli-imtahanlar',
      keywords: 'sertifikatlı imtahan, skill assessment, IELTS, Python, Data Analytics, Mentorix',
      breadcrumbs: [
        { name: 'Mentorix', path: '/' },
        { name: 'Sertifikatlı imtahanlar', path: '/sertifikatli-imtahanlar' },
      ],
    })
  }, [])

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
  }, [])

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-gray-100 flex flex-col">
      <header className="border-b border-white/10 bg-[#0b0b0b]/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0">
            <Brand compact />
          </Link>
          <Link
            to="/login"
            className="rounded-lg bg-primary/15 border border-primary/35 text-primary px-3 py-1.5 text-sm font-semibold hover:bg-primary/25"
          >
            Daxil ol
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 sm:py-10 space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
            <span aria-hidden>🎓</span> Skill Assessment Ecosystem
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white">Sertifikatlı imtahan kataloqu</h1>
          <p className="text-sm text-gray-400 max-w-2xl">
            Beynəlxalq imtahanlardan IT, Data Analytics, Cloud, Cyber Security və digər peşəkar bacarıqlara qədər —
            sahəni seç, imtahan ver, sertifikat qazan.
          </p>
          {stats ? (
            <p className="text-xs text-gray-500">
              {stats.certificates_issued} sertifikat verilib · {stats.verified_exam_types} aktiv assessment
            </p>
          ) : null}
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Yüklənir…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/sertifikatli-imtahanlar/${encodeURIComponent(cat.slug)}`}
                className="group rounded-2xl border border-white/10 bg-[#121212]/90 p-5 hover:border-primary/35 hover:shadow-[0_0_32px_-12px_rgba(0,229,176,0.3)] transition"
              >
                <div className="text-3xl mb-3" aria-hidden>
                  {cat.icon || '📚'}
                </div>
                <h2 className="text-base font-semibold text-white group-hover:text-primary transition-colors">
                  {cat.name}
                </h2>
                <p className="text-sm text-primary/90 mt-2 tabular-nums">
                  {cat.assessment_count} Assessment{cat.assessment_count === 1 ? '' : 's'}
                </p>
                {cat.description ? (
                  <p className="text-[11px] text-gray-500 mt-2 line-clamp-2">{cat.description}</p>
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
