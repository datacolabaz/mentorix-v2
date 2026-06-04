import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../../lib/api'
import Brand from '../../components/common/Brand'
import InstructorAvatar from '../../components/common/InstructorAvatar'
import { setPageSeo } from '../../lib/pageSeo'
import { instructorDisplaySubject } from '../../lib/instructorDisplay'
import InquiryFormModal from '../../components/discover/InquiryFormModal'
import DiscoverAuthModal from '../../components/discover/DiscoverAuthModal'
import useAuthStore from '../../hooks/useAuth'

function kindLabel(k) {
  if (k === 'trainer') return 'Təlimçi'
  return 'Müəllim'
}

function formatDelivery(f) {
  if (f === 'online') return 'Onlayn'
  if (f === 'teacher_place') return 'Müəllimin ünvanında'
  if (f === 'student_place') return 'Tələbənin ünvanında'
  return f
}

export default function PublicInstructorProfile() {
  const { id } = useParams()
  const { user, token } = useAuthStore()
  const isAuthenticated = Boolean(token && user)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [instructor, setInstructor] = useState(null)
  const [inquiryOpen, setInquiryOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError('')
    api
      .get(`/public/instructors/${id}`)
      .then((res) => {
        if (cancelled) return
        if (res?.success && res.instructor) {
          setInstructor(res.instructor)
          setPageSeo({
            title: `${res.instructor.full_name} — Mentorix müəllim profili`,
            description:
              res.instructor.discover_bio?.slice(0, 160) ||
              `${res.instructor.full_name} — ${res.instructor.subject}. Mentorix üzərində müəllim profili.`,
            canonicalPath: `/teachers/${id}`,
          })
        } else {
          setInstructor(null)
          setError(res?.message || 'Profil tapılmadı')
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setInstructor(null)
          setError(e?.message || 'Xəta')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const onInquiry = () => {
    if (isAuthenticated) setInquiryOpen(true)
    else setAuthModalOpen(true)
  }

  const subjectLine = instructor ? instructorDisplaySubject(instructor) : null
  const formats = Array.isArray(instructor?.delivery_formats) ? instructor.delivery_formats : []

  return (
    <div className="min-h-[100svh] bg-[#0b0b0b] text-white">
      <header className="border-b border-white/10 bg-[#0f0f0f]/95">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Brand className="h-7 w-auto" />
          <Link to="/search" className="text-sm font-semibold text-primary hover:underline">
            ← Axtarışa qayıt
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-32 w-32 rounded-full bg-white/10 mx-auto" />
            <div className="h-6 bg-white/10 rounded-lg max-w-xs mx-auto" />
            <div className="h-20 bg-white/5 rounded-xl" />
          </div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-xl border border-white/10 bg-[#121212] p-8 text-center">
            <p className="text-white font-semibold">{error}</p>
            <Link to="/search" className="inline-block mt-4 text-sm text-primary font-semibold hover:underline">
              Xəritə axtarışına keç
            </Link>
          </div>
        ) : null}

        {!loading && instructor ? (
          <article className="space-y-6">
            <div className="flex flex-col items-center text-center gap-4">
              <InstructorAvatar
                fullName={instructor.full_name}
                avatarUrl={instructor.avatar_url}
                size="xl"
                kind={instructor.map_profile_kind}
                ringClassName="ring-4 ring-primary/40"
              />
              <div>
                {instructor.is_top_listing ? (
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 mb-2">
                    🔥 TOP müəllim
                  </span>
                ) : null}
                {instructor.is_featured_listing ? (
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 mb-2 ml-1">
                    ⭐ Önə çıxır
                  </span>
                ) : null}
                {instructor.discover_verified ? (
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 mb-2 ml-1">
                    Təsdiqlənmiş
                  </span>
                ) : null}
                <h1 className="font-display font-bold text-2xl text-white">{instructor.full_name}</h1>
                <p className="text-sm text-gray-400 mt-1">
                  {subjectLine || 'Fənn göstərilməyib'}
                </p>
                <p className="text-xs text-gray-500 mt-1">{kindLabel(instructor.map_profile_kind)}</p>
                {instructor.discover_hourly_rate != null ? (
                  <p className="text-emerald-400 font-semibold mt-2">{instructor.discover_hourly_rate} AZN/saat</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onInquiry}
                className="w-full max-w-sm rounded-xl bg-primary text-[#0b0b0b] font-bold py-3 px-4 hover:brightness-110 transition"
              >
                Müraciət göndər
              </button>
            </div>

            {instructor.discover_bio ? (
              <section className="rounded-xl border border-white/10 bg-[#121212]/90 p-5">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Haqqında</h2>
                <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{instructor.discover_bio}</p>
              </section>
            ) : null}

            {formats.length ? (
              <section className="rounded-xl border border-white/10 bg-[#121212]/90 p-5">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Dərs formatı</h2>
                <ul className="flex flex-wrap gap-2">
                  {formats.map((f) => (
                    <li
                      key={f.format}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 text-gray-200"
                    >
                      {formatDelivery(f.format)}
                      {f.format === 'student_place' && f.travel_radius_km != null
                        ? ` · ${f.travel_radius_km} km`
                        : ''}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {instructor.teacher_place_address ? (
              <section className="rounded-xl border border-white/10 bg-[#121212]/90 p-5 text-sm text-gray-300">
                <span className="text-gray-500 text-xs font-bold uppercase tracking-wider block mb-1">Ünvan</span>
                {instructor.teacher_place_address}
              </section>
            ) : null}
          </article>
        ) : null}
      </main>

      <InquiryFormModal
        open={inquiryOpen && Boolean(instructor)}
        onClose={() => setInquiryOpen(false)}
        instructor={instructor}
      />
      <DiscoverAuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  )
}
