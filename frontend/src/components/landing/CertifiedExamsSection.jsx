import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { trackEvent } from '../../lib/analytics'
import CertificatePreviewMockup from './CertificatePreviewMockup'

export default function CertifiedExamsSection({ onHowItWorks }) {
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [stats, setStats] = useState({ certificates_issued: 0, verified_exam_types: 0 })

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
  }, [])

  return (
    <section
      id="mx-certified-exams"
      className="scroll-mt-24 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-[#0e1412] to-[#0b0b0b] p-6 sm:p-8 space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
        <div className="flex-1 space-y-4 min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
            <span aria-hidden>🎓</span>
            Sertifikatlı İmtahanlar
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold text-white leading-tight">
            Bilikini sertifikatla təsdiqlə
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed max-w-xl">
            Beynəlxalq imtahanlardan IT, Data Analytics, Cloud və digər peşəkar bacarıqlara qədər — sahəni seç,
            imtahan ver, QR ilə doğrulanan sertifikat qazan.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <p className="text-sm font-semibold text-white">{cat.name}</p>
                <p className="text-[11px] text-primary/90 mt-1 tabular-nums">
                  {cat.assessment_count} Assessment{cat.assessment_count === 1 ? '' : 's'}
                </p>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 max-w-md">
            <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5">
              <div className="text-lg font-semibold text-white tabular-nums">{stats.certificates_issued}+</div>
              <div className="text-[10px] text-gray-500">sertifikat verilib</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5">
              <div className="text-lg font-semibold text-primary tabular-nums">{stats.verified_exam_types}+</div>
              <div className="text-[10px] text-gray-500">aktiv assessment</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-1">
            <Link
              to="/sertifikatli-imtahanlar"
              onClick={() => trackEvent('mx_landing_certified_cta', { action: 'catalog' })}
              className="inline-flex justify-center items-center rounded-xl bg-primary px-5 py-3 min-h-[48px] text-sm font-bold text-[#041018] shadow-lg shadow-primary/25 hover:brightness-95"
            >
              Pulsuz imtahan tap
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
              Necə işləyir?
            </button>
          </div>
        </div>

        <div className="w-full lg:w-[280px] shrink-0 mx-auto lg:mx-0">
          <CertificatePreviewMockup />
        </div>
      </div>
    </section>
  )
}
