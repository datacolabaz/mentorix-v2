import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../../lib/api'
import Brand from '../../components/common/Brand'
import InstructorAvatar from '../../components/common/InstructorAvatar'
import { setPageSeo } from '../../lib/pageSeo'
import { instructorDisplaySubject } from '../../lib/instructorDisplay'
import InquiryFormModal from '../../components/discover/InquiryFormModal'
import DiscoverAuthModal from '../../components/discover/DiscoverAuthModal'
import TeacherReviewPanel from '../../components/discover/TeacherReviewPanel'
import useAuthStore from '../../hooks/useAuth'
import { useToast } from '../../components/common/Toast'
import { ratingStarsLine, formatStudentCount, deliveryFormatBadges } from '../../lib/teacherMapCard'

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

function ProfileSection({ title, children, className = '' }) {
  return (
    <section
      className={`rounded-2xl border border-white/10 bg-[#121212]/95 p-5 sm:p-6 ${className}`.trim()}
    >
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{title}</h2>
      {children}
    </section>
  )
}

function expertiseTags(instructor) {
  const cats = Array.isArray(instructor?.category_names) ? instructor.category_names : []
  const seen = new Set()
  const out = []
  for (const raw of cats) {
    const t = String(raw || '').trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

export default function PublicInstructorProfile() {
  const { id } = useParams()
  const { user, token } = useAuthStore()
  const isAuthenticated = Boolean(token && user)
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [instructor, setInstructor] = useState(null)
  const [inquiryOpen, setInquiryOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [whatsappBusy, setWhatsappBusy] = useState(false)

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

  const onWhatsApp = async () => {
    if (!instructor?.id) return
    if (!isAuthenticated) {
      setAuthModalOpen(true)
      return
    }
    setWhatsappBusy(true)
    try {
      const d = await api.get(`/public/instructors/${encodeURIComponent(instructor.id)}/messaging`)
      if (d?.whatsapp_available && d.whatsapp_url) {
        window.open(d.whatsapp_url, '_blank', 'noopener,noreferrer')
      } else {
        toast('Müəllimin WhatsApp nömrəsi yoxdur — müraciət formunu doldurun.', 'info')
        setInquiryOpen(true)
      }
    } catch (e) {
      toast(e?.message || 'WhatsApp açılmadı', 'error')
    } finally {
      setWhatsappBusy(false)
    }
  }

  const ratingLine = instructor ? ratingStarsLine(instructor) : null
  const studentLine = instructor ? formatStudentCount(instructor.active_student_count) : null
  const formatBadges = instructor ? deliveryFormatBadges(instructor) : []

  const subjectLine = instructor ? instructorDisplaySubject(instructor) : null
  const tags = useMemo(() => (instructor ? expertiseTags(instructor) : []), [instructor])
  const bio = String(instructor?.bio || instructor?.discover_bio || '').trim()
  const education = String(instructor?.education || instructor?.discover_education || '').trim()
  const certifications = String(instructor?.discover_certifications || '').trim()
  const experienceYears =
    instructor?.experience_years != null && Number.isFinite(Number(instructor.experience_years))
      ? Number(instructor.experience_years)
      : null

  return (
    <div className="min-h-[100svh] bg-[#0b0b0b] text-white flex flex-col">
      <header className="shrink-0 border-b border-white/10 bg-[#0f0f0f]/95 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Brand className="h-7 w-auto" />
          <Link to="/search" className="text-sm font-semibold text-primary hover:underline shrink-0">
            ← Axtarışa qayıt
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:py-8 pb-12">
        {loading ? (
          <div className="space-y-5 animate-pulse max-w-xl mx-auto">
            <div className="h-36 w-36 rounded-full bg-white/10 mx-auto" />
            <div className="h-8 bg-white/10 rounded-xl max-w-xs mx-auto" />
            <div className="h-24 bg-white/5 rounded-2xl" />
            <div className="h-32 bg-white/5 rounded-2xl" />
          </div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-2xl border border-white/10 bg-[#121212] p-8 text-center max-w-lg mx-auto">
            <p className="text-white font-semibold">{error}</p>
            <Link to="/search" className="inline-block mt-4 text-sm text-primary font-semibold hover:underline">
              Xəritə axtarışına keç
            </Link>
          </div>
        ) : null}

        {!loading && instructor ? (
          <article className="space-y-5 sm:space-y-6">
            {/* Üst blok: şəkil, ad, fənn, qiymət */}
            <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#1a1a1a] to-[#121212] p-6 sm:p-8">
              <div className="flex flex-col items-center text-center gap-4 max-w-md mx-auto">
                <InstructorAvatar
                  fullName={instructor.full_name}
                  avatarUrl={instructor.avatar_url}
                  size="xl"
                  kind={instructor.map_profile_kind}
                  ringClassName="ring-4 ring-primary/40"
                />
                <div className="w-full">
                  <div className="flex flex-wrap justify-center gap-1.5 mb-2">
                    {instructor.is_top_listing ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300">
                        🔥 TOP müəllim
                      </span>
                    ) : null}
                    {instructor.is_featured_listing ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300">
                        ⭐ Önə çıxır
                      </span>
                    ) : null}
                    {instructor.discover_verified ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400">
                        Təsdiqlənmiş
                      </span>
                    ) : null}
                  </div>
                  <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">{instructor.full_name}</h1>
                  <p className="text-sm sm:text-base text-gray-300 mt-2 font-medium">
                    {subjectLine || 'Fənn göstərilməyib'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{kindLabel(instructor.map_profile_kind)}</p>
                  {(ratingLine || studentLine) && (
                    <div className="flex flex-wrap justify-center gap-2 mt-3">
                      {ratingLine ? (
                        <span className="text-sm font-semibold text-amber-200 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10">
                          {ratingLine}
                        </span>
                      ) : null}
                      {studentLine ? (
                        <span className="text-sm font-medium text-gray-300 px-3 py-1 rounded-full border border-white/15 bg-white/5">
                          👥 {studentLine}
                        </span>
                      ) : null}
                    </div>
                  )}
                  <div className="flex flex-wrap justify-center gap-2 mt-3">
                    {experienceYears != null && experienceYears > 0 ? (
                      <span className="text-sm font-semibold text-sky-300/95 px-3 py-1 rounded-full border border-sky-500/30 bg-sky-500/10">
                        {experienceYears} il təcrübə
                      </span>
                    ) : null}
                    {instructor.discover_hourly_rate != null ? (
                      <p className="text-emerald-400 font-bold text-lg">
                        {instructor.discover_hourly_rate} AZN / saat
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="w-full max-w-sm pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onInquiry}
                    className="w-full rounded-xl bg-primary text-[#0b0b0b] font-bold py-3.5 px-4 hover:brightness-110 transition shadow-lg shadow-primary/20"
                  >
                    ⚡ Sınaq dərsi — müraciət
                  </button>
                  <button
                    type="button"
                    disabled={whatsappBusy}
                    onClick={onWhatsApp}
                    className="w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-bold py-3.5 px-4 hover:bg-emerald-500/20 transition disabled:opacity-50"
                  >
                    💬 WhatsApp
                  </button>
                  <p className="text-[11px] sm:text-xs text-gray-500 mt-1 leading-relaxed px-1 sm:col-span-2">
                    WhatsApp və müraciət üçün qeydiyyat tələb olunur. Müraciət SMS və panel bildirişi ilə
                    çatdırılır.
                  </p>
                </div>
              </div>
            </section>

            {formatBadges.length > 0 ? (
              <ProfileSection title="Dərs formatı">
                <ul className="flex flex-wrap gap-2">
                  {formatBadges.map((lab) => (
                    <li
                      key={lab}
                      className="text-xs sm:text-sm font-medium px-3 py-2 rounded-xl border border-white/15 bg-white/5 text-gray-200"
                    >
                      {lab}
                    </li>
                  ))}
                </ul>
                {instructor.next_available_slot ? (
                  <p className="text-sm text-gray-300 mt-3">
                    📅 Növbəti boş vaxt:{' '}
                    <span className="font-semibold text-white">{instructor.next_available_slot}</span>
                  </p>
                ) : null}
              </ProfileSection>
            ) : null}

            <TeacherReviewPanel
              instructorId={instructor.id}
              instructor={instructor}
              isAuthenticated={isAuthenticated}
              onNeedAuth={() => setAuthModalOpen(true)}
            />

            <ProfileSection title="Haqqımda">
              {bio ? (
                <p className="text-sm sm:text-[15px] text-gray-200 leading-relaxed whitespace-pre-wrap">{bio}</p>
              ) : (
                <p className="text-sm text-gray-500 italic">Müəllim hələ bio əlavə etməyib.</p>
              )}
            </ProfileSection>

            {tags.length > 0 ? (
              <ProfileSection title="Ekspertizalar">
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-full border border-primary/35 bg-primary/10 text-primary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </ProfileSection>
            ) : null}

            {education || certifications ? (
              <ProfileSection title="Təhsil və sertifikatlar">
                <div className="space-y-4 text-sm text-gray-200 leading-relaxed">
                  {education ? (
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Təhsil</p>
                      <p className="whitespace-pre-wrap">{education}</p>
                    </div>
                  ) : null}
                  {certifications ? (
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                        Sertifikatlar
                      </p>
                      <p className="whitespace-pre-wrap">{certifications}</p>
                    </div>
                  ) : null}
                </div>
              </ProfileSection>
            ) : null}

            {instructor.teacher_place_address ? (
              <ProfileSection title="Ünvan">
                <p className="text-sm text-gray-300 leading-relaxed">{instructor.teacher_place_address}</p>
              </ProfileSection>
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
