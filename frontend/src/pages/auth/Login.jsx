import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useAuthStore from '../../hooks/useAuth'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import PhoneInput from '../../components/auth/PhoneInput'
import Brand from '../../components/common/Brand'
import api from '../../lib/api'

function RoleIcon({ role }) {
  const base = 'h-7 w-7 text-primary'
  if (role === 'instructor') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={base} aria-hidden>
        <path
          d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 9a7 7 0 0 1 14 0"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M17.5 3.5h4v4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  if (role === 'student') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={base} aria-hidden>
        <path
          d="M12 3 2 8l10 5 10-5-10-5Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M6 10.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-5.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={base} aria-hidden>
      <path
        d="M8 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M2.5 21a5.5 5.5 0 0 1 11 0m-1.5 0a5.5 5.5 0 0 1 11 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

const ROLES = [
  { key: 'instructor', label: 'Müəllim' },
  { key: 'student', label: 'Tələbə' },
  { key: 'parent', label: 'Valideyn' },
]

function scrollToId(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function formatAzInt(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return new Intl.NumberFormat('az-Latn-AZ').format(Number(n))
}

function formatPlusStudents(n, loading) {
  if (loading) return '…'
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `+${formatAzInt(v)}`
}

function upliftLine(pct, loading) {
  if (loading) return '…'
  if (pct == null || !Number.isFinite(Number(pct))) return '+30% daha yaxşı davamiyyət'
  const rounded = Math.round(Number(pct))
  if (rounded > 0) return `+${formatAzInt(rounded)}% daha yaxşı davamiyyət`
  if (rounded < 0) return `${formatAzInt(rounded)}% davamiyyət (əvvəlki aya nisbətən)`
  return 'Davamiyyət əvvəlki ay ilə eyni səviyyədə'
}

/** PIN + admin email girişi (OTP yox — daimi PIN bir dəfə SMS) */
export default function Login() {
  const [searchParams] = useSearchParams()
  const isAdmin = searchParams.get('admin') === 'true'

  const [role, setRole] = useState(null)
  const [adminIdentifier, setAdminIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [pinInput, setPinInput] = useState('')

  // Default onboarding: Google-first
  const [mode, setMode] = useState('google') // google | phone
  const [step, setStep] = useState('google') // google | role | teacher_phone | teacher_otp | phone | pin
  const [googleCredential, setGoogleCredential] = useState(null)
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const   googleBtnRef = useRef(null)
  const [loading, setLoading] = useState(false)

  const loginSectionRef = useRef(null)
  const [landingLoading, setLandingLoading] = useState(!isAdmin)
  const [landingStats, setLandingStats] = useState(null)
  const [demoOpen, setDemoOpen] = useState(false)

  const { login, phoneNextStep, forgotPinSms, pinLogin, googleLogin, googleComplete, sendOtp, verifyOtp } =
    useAuthStore()
  const navigate = useNavigate()
  const toast = useToast()
  const roleMap = { admin: '/admin', instructor: '/instructor', student: '/student', parent: '/parent' }

  const goDashboard = (r) => navigate(roleMap[r] || '/login', { replace: true })

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const user = await login(adminIdentifier, password)
      goDashboard(user.role)
    } catch (err) {
      toast(err.message || 'Giriş xətası', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handlePhoneContinue = async (e) => {
    e.preventDefault()
    if (!role) return
    setLoading(true)
    try {
      const data = await phoneNextStep(phone, role)
      if (data.next === 'pin') {
        setStep('pin')
        setPinInput('')
        if (data.pin_sms_sent) {
          toast(data.message || 'Nömrənizə daimi PIN SMS ilə göndərildi', 'success')
        } else {
          toast(data.message || 'PIN kodunuzu daxil edin', 'success')
        }
      } else {
        toast('Gözlənilməz cavab. Səhifəni yeniləyib yenidən cəhd edin.', 'error')
      }
    } catch (err) {
      toast(err.message || 'Xəta', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handlePinLogin = async (e) => {
    e.preventDefault()
    if (!role) return
    setLoading(true)
    try {
      const user = await pinLogin(phone, pinInput, role)
      goDashboard(user.role)
    } catch (err) {
      if (err.needs_setup) toast(err.message || 'Əvvəlcə "Davam et" basın', 'error')
      else toast(err.message || 'PIN yanlışdır', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPinSms = async () => {
    if (!role) return
    setLoading(true)
    try {
      const data = await forgotPinSms(phone, role)
      setPinInput('')
      toast(data.message || 'Yeni PIN SMS ilə göndərildi', 'success')
    } catch (err) {
      toast(err.message || 'SMS göndərilmədi', 'error')
    } finally {
      setLoading(false)
    }
  }

  const resetFlow = () => {
    setStep(mode === 'phone' ? 'phone' : 'google')
    setPinInput('')
  }

  const roleTitle = useMemo(() => {
    const r = ROLES.find((x) => x.key === role)
    return r?.label || '—'
  }, [role])

  useEffect(() => {
    if (isAdmin) return
    if (mode !== 'google') return
    if (step !== 'google') return

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return

    let cancelled = false
    let ticks = 0
    let renderFailures = 0
    let inited = false

    const MAX_TICKS = 120 // ~6s @ 50ms — covers slow async GIS script loads on mobile navigations
    const MAX_RENDER_FAILURES = 8

    const tryMount = () => {
      if (cancelled || inited) return false
      const el = googleBtnRef.current
      if (!el) return false

      const g = window.google
      if (!g?.accounts?.id) {
        return false
      }

      const buttonWidthPx = () => {
        // GIS `width` is in pixels; fixed 320 overflows on narrow phones (esp. real iOS), while devtools responsive can mislead.
        const host = el.parentElement
        const avail = host?.clientWidth || el.clientWidth || document.documentElement.clientWidth || 320
        const padded = Math.max(0, Math.floor(avail))
        return Math.max(240, Math.min(320, padded))
      }

      try {
        g.accounts.id.initialize({
          client_id: clientId,
          callback: async (resp) => {
            const cred = resp?.credential
            if (!cred) return toast('Google giriş alınmadı', 'error')
            setLoading(true)
            try {
              const r = await googleLogin(cred)
              if (r?.token && r?.user) {
                goDashboard(r.user.role)
                return
              }
              if (r?.needs_role) {
                setGoogleCredential(cred)
                setStep('role')
                return
              }
              toast(r?.message || 'Giriş alınmadı', 'error')
            } catch (e) {
              toast(e?.message || 'Google giriş xətası', 'error')
            } finally {
              setLoading(false)
            }
          },
        })

        el.innerHTML = ''
        g.accounts.id.renderButton(el, {
          theme: 'outline',
          size: 'large',
          width: buttonWidthPx(),
          text: 'continue_with',
          shape: 'pill',
        })

        // Mobile Safari / some layouts can make the GIS iframe ignore taps if layered.
        el.style.pointerEvents = 'auto'
        inited = true
        return true
      } catch {
        renderFailures += 1
        return renderFailures >= MAX_RENDER_FAILURES
      }
    }

    let iv = null
    iv = window.setInterval(() => {
      if (cancelled || inited) {
        if (iv) window.clearInterval(iv)
        return
      }
      ticks += 1
      const done = tryMount()
      if (done || ticks >= MAX_TICKS) {
        if (iv) window.clearInterval(iv)
      }
    }, 50)

    // Immediate attempt on mount (helps when GIS is already present).
    if (tryMount() && iv) {
      window.clearInterval(iv)
      iv = null
    }

    return () => {
      cancelled = true
      if (iv) window.clearInterval(iv)
      try {
        window.google?.accounts?.id?.cancel?.()
      } catch {
        // ignore
      }
    }
  }, [isAdmin, mode, step, googleLogin, toast])

  useEffect(() => {
    if (isAdmin) return
    let cancelled = false
    ;(async () => {
      setLandingLoading(true)
      try {
        const data = await api.get('/public/landing-stats', { params: { top: 6 } })
        if (!cancelled && data?.success && data?.stats) setLandingStats(data.stats)
      } catch {
        if (!cancelled) setLandingStats(null)
      } finally {
        if (!cancelled) setLandingLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  const completeGoogleWithRole = async (pickedRole) => {
    if (!googleCredential) return
    setLoading(true)
    try {
      const data = await googleComplete(googleCredential, pickedRole)
      if (pickedRole === 'instructor') {
        setRole('instructor')
        setStep('teacher_phone')
        return
      }
      goDashboard(data.user.role)
    } catch (e) {
      toast(e?.message || 'Qeydiyyat tamamlanmadı', 'error')
    } finally {
      setLoading(false)
    }
  }

  const sendTeacherOtp = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await sendOtp(phone, 'instructor')
      setOtpSent(true)
      setStep('teacher_otp')
      toast('OTP göndərildi', 'success')
    } catch (err) {
      toast(err?.message || 'OTP göndərilmədi', 'error')
    } finally {
      setLoading(false)
    }
  }

  const verifyTeacherOtp = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await verifyOtp(phone, otpCode, 'instructor', { saveOtpAsPin: true })
      goDashboard('instructor')
    } catch (err) {
      toast(err?.message || 'OTP yanlışdır', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100svh] bg-[#0b0b0b]">
      {!isAdmin ? (
        <div className="w-full max-w-5xl mx-auto px-4 pt-10 sm:pt-14 pb-6 space-y-14">
          <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div className="max-w-xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-gray-300">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_12px_rgba(0,229,176,0.9)]" />
                Mentorix — müəllimlər üçün idarəetmə
              </div>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
                Şagirdlərini daha effektiv idarə et
              </h1>
              <p className="text-gray-400 text-sm sm:text-base leading-relaxed">
                Dərs planlama, ödəniş izləmə və avtomatik xatırlatmalar — hamısı bir platformada
              </p>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => scrollToId('mx-login')}
                  className="inline-flex justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-[#041018] shadow-lg shadow-primary/20 hover:brightness-95"
                >
                  Pulsuz başla
                </button>
                <button
                  type="button"
                  onClick={() => scrollToId('mx-how')}
                  className="inline-flex justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-gray-100 hover:bg-white/10"
                >
                  Necə işləyir?
                </button>
                <button
                  type="button"
                  onClick={() => setDemoOpen(true)}
                  className="inline-flex justify-center rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-gray-300 hover:border-white/20 hover:text-white"
                >
                  Demo bax
                </button>
              </div>
              <button
                type="button"
                onClick={() => scrollToId('mx-login')}
                className="text-left text-xs text-gray-500 hover:text-gray-300 underline underline-offset-4"
              >
                Artıq hesabım var — girişə keç
              </button>
            </div>

            <div
              id="mx-demo-mini"
              className="relative w-full sm:w-[340px] shrink-0 rounded-2xl border border-white/10 bg-gradient-to-br from-[#131313] to-[#0a0f12] p-4 shadow-[0_0_80px_-20px_rgba(0,229,176,0.35)] overflow-hidden"
            >
              <div className="absolute inset-x-8 -top-16 h-32 rounded-full bg-primary/25 blur-3xl" />
              <div className="relative space-y-3">
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>İdarə paneli (prevyu)</span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-gray-300 border border-white/10">
                    bu gün
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-black/35 border border-white/10 px-2 py-2">
                    <div className="text-[10px] text-gray-500">Tələbələr</div>
                    <div className="text-sm font-semibold text-white">{formatAzInt(landingStats?.students_managed)}</div>
                  </div>
                  <div className="rounded-xl bg-black/35 border border-white/10 px-2 py-2">
                    <div className="text-[10px] text-gray-500">Bu ay</div>
                    <div className="text-sm font-semibold text-primary">Ödənişlər</div>
                  </div>
                  <div className="rounded-xl bg-black/35 border border-white/10 px-2 py-2">
                    <div className="text-[10px] text-gray-500">SMS</div>
                    <div className="text-sm font-semibold text-amber-300/90">Aktiv</div>
                  </div>
                </div>
                <div className="rounded-xl bg-black/25 border border-white/10 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-gray-100">Bu həftə — dərs qrafiki</div>
                    <div className="text-[10px] text-gray-500">Pn–Cu</div>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {['Pn', 'Ç', 'Çr', 'Ca', 'Cm'].map((d) => (
                      <div
                        key={d}
                        className="rounded-lg bg-white/5 border border-white/5 px-1 py-2 text-center text-[10px] text-gray-400"
                      >
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 flex-1 rounded-lg bg-primary/15 border border-primary/25 text-[11px] text-primary px-2 flex items-center justify-center font-medium">
                      18:30
                    </div>
                    <div className="h-8 flex-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-gray-400 px-2 flex items-center justify-center">
                      19:45
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <section id="mx-trust" className="space-y-4">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">İnam göstəriciləri</div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-surface-2/80 backdrop-blur-sm p-4">
                <div className="text-sm text-gray-400 leading-snug">{formatPlusStudents(landingStats?.students_managed, landingLoading)} tələbə idarə olunur</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-surface-2/80 backdrop-blur-sm p-4">
                <div className="text-sm text-gray-400 leading-snug">{formatPlusStudents(landingStats?.instructor_count, landingLoading)} müəllim istifadə edir</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-surface-2/80 backdrop-blur-sm p-4">
                <div className="text-sm text-gray-200 leading-snug font-medium">
                  {upliftLine(landingStats?.attendance_uplift_percent, landingLoading)}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">Son ay vs əvvəlki ay — qeydə alınmış dərslər üzrə</div>
              </div>
            </div>
          </section>

          <section id="mx-top" className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Top müəllimlər</div>
                <p className="text-sm text-gray-400 mt-1">Platformada daha çox aktiv şagirdi olan heyət (canlı statistikadan)</p>
              </div>
            </div>
            {landingStats?.top_instructors?.length ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {landingStats.top_instructors.map((t) => (
                  <div key={t.id} className="rounded-2xl border border-white/10 bg-[#131313]/90 p-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-white truncate">{t.display_name}</div>
                      <div className="text-[11px] text-gray-500 shrink-0">{formatAzInt(t.student_count)} şagird</div>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="text-amber-300/95">
                        {t.rating_stars != null ? (
                          <>
                            ★ {t.rating_stars.toFixed(1)}
                            <span className="text-gray-500"> / 5</span>
                          </>
                        ) : (
                          <span className="text-gray-500">Reytinq: qeydə alınmış dərs əsaslı</span>
                        )}
                      </div>
                      <div className="text-gray-500">{t.attendance_percent != null ? `${formatAzInt(t.attendance_percent)}% davamiyyət` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-gray-400">
                {landingLoading
                  ? 'Müəllim reytinqləri yüklənir…'
                  : 'Hələ anonim sıralama üçün kifayət qədər aktiv məlumat yoxdur. Qısa zaman ərzində burada görünəcək.'}
              </div>
            )}
          </section>

          <section id="mx-how" className="space-y-4">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">İmkanlar</div>
            <div className="grid md:grid-cols-3 gap-3">
              {[
                { t: 'Dərs cədvəli', d: 'Həftəlik planı bir ekrandan idarə edin və dərsi təqib edin.', accent: 'from-sky-500/15' },
                { t: 'Ödəniş sistemi', d: 'Paket və aylıq ödəniş axınlarını strukturlaşdırın, gecikmələri əvvəlcədən görün.', accent: 'from-emerald-500/15' },
                { t: 'SMS xatırlatma', d: 'Valideyn/tələbə üçün avtomatik xəbərdarlıq — əlavə yükləmə olmadan.', accent: 'from-amber-500/15' },
              ].map((x) => (
                <div
                  key={x.t}
                  className={`rounded-2xl border border-white/10 bg-gradient-to-br ${x.accent} to-[#101010] p-4 space-y-2`}
                >
                  <div className="text-sm font-semibold text-white">{x.t}</div>
                  <p className="text-xs text-gray-400 leading-relaxed">{x.d}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="mx-cta" className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-[#0e1412] to-[#0b0b0b] p-6 sm:p-8">
            <div className="space-y-2 max-w-xl">
              <div className="text-lg sm:text-xl font-semibold text-white">Müəllim kimi daha az kaos — daha çox nəzarət</div>
              <p className="text-sm text-gray-300 leading-relaxed">
                Bir dəqiqədə başlayın — dəyəri görəndən sonra qeydiyyatı tamamlayın.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <button
                type="button"
                onClick={() => scrollToId('mx-login')}
                className="inline-flex justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-[#041018] shadow-lg shadow-primary/25 hover:brightness-95"
              >
                Pulsuz başla
              </button>
              <button
                type="button"
                onClick={() => scrollToId('mx-how')}
                className="inline-flex justify-center rounded-xl border border-white/20 bg-black/25 px-5 py-3 text-sm font-semibold text-gray-100 hover:bg-black/35"
              >
                Necə işləyir?
              </button>
              <button
                type="button"
                onClick={() => setDemoOpen(true)}
                className="inline-flex justify-center rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-gray-100 hover:bg-white/5"
              >
                Demo bax
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <div className={`flex justify-center px-4 ${isAdmin ? 'min-h-[100svh] items-start sm:items-center pt-8 sm:pt-4 pb-10' : 'pb-14 pt-4'}`}>
        <div id="mx-login" ref={loginSectionRef} className="w-full max-w-sm scroll-mt-6">
          <div className="bg-surface-2 border border-white/10 rounded-2xl p-6 sm:p-8">
            {!isAdmin ? (
              <div className="text-center mb-5">
                <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Giriş</div>
                <div className="text-gray-200 text-sm font-semibold mt-1">Hesabına daxil ol</div>
                <div className="text-gray-500 text-xs mt-1">Əvvəlcə məhsulu yuxarıda gör — sonra qeydiyyatı rahat keç.</div>
              </div>
            ) : (
              <div className="text-center mb-6 sm:mb-8">
                <div className="flex justify-center pt-1 pb-3 bg-transparent">
                  <Brand size="login" />
                </div>
                <div className="text-gray-400 text-sm mt-1">Hesabınıza daxil olun</div>
              </div>
            )}

            {!isAdmin ? (
              <div className="flex justify-center mb-6">
                <Brand size="login" />
              </div>
            ) : null}

            {isAdmin && (
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="text-center text-red-400 text-xs py-2 px-3 bg-red-500/10 border border-red-500/20 rounded-xl mb-4">
                  Admin panel
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Telefon və ya email
                  </label>
                  <input
                    className="w-full bg-surface-1 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary/40"
                    type="text"
                    placeholder="+994XXXXXXXXX və ya admin email"
                    value={adminIdentifier}
                    onChange={(e) => setAdminIdentifier(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Şifrə
                  </label>
                  <input
                    className="w-full bg-surface-1 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary/40"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" loading={loading} className="w-full justify-center py-3">
                  Daxil ol
                </Button>
              </form>
            )}

            {!isAdmin && (
              <>
                {mode === 'google' ? (
                  <>
                    {step === 'google' ? (
                      <div className="space-y-4">
                        <div className="relative z-10 w-full flex justify-center min-w-0">
                          <div
                            ref={googleBtnRef}
                            className="pointer-events-auto inline-flex max-w-full"
                            style={{ minHeight: 44 }}
                          />
                        </div>
                        <div className="text-center">
                          <button
                            type="button"
                            className="text-xs text-gray-400 hover:text-gray-200 underline underline-offset-4"
                            onClick={() => {
                              setMode('phone')
                              setStep('phone')
                              setRole(null)
                              setPhone('')
                              setPinInput('')
                            }}
                          >
                            Telefonla daxil ol
                          </button>
                        </div>
                        <div className="text-[11px] text-gray-500 leading-relaxed text-center">
                          Yeni hesab üçün <strong className="text-gray-300">Google</strong> ilə davam edin. Mövcud hesabınız varsa{' '}
                          <strong className="text-gray-300">Telefonla daxil ol</strong>.
                        </div>
                      </div>
                    ) : null}

                    {step === 'role' ? (
                      <div className="space-y-4">
                        <div className="text-center text-sm text-gray-300 font-semibold">Rol seçin</div>
                        <div className="grid grid-cols-3 gap-3">
                          {ROLES.map((r) => (
                            <button
                              key={r.key}
                              type="button"
                              onClick={() => void completeGoogleWithRole(r.key)}
                              className="p-3 rounded-xl border text-sm font-semibold transition-all flex flex-col items-center gap-1 border-white/10 text-gray-200 hover:border-white/20"
                            >
                              <RoleIcon role={r.key} />
                              <span className="text-xs">{r.label}</span>
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="w-full text-center text-xs text-gray-500 hover:text-white"
                          onClick={() => {
                            setStep('google')
                            setGoogleCredential(null)
                          }}
                        >
                          ← Geri
                        </button>
                      </div>
                    ) : null}

                    {step === 'teacher_phone' ? (
                      <form onSubmit={sendTeacherOtp} className="space-y-4">
                        <div className="text-center text-xs text-gray-400">
                          <span className="font-semibold text-gray-200">Müəllim</span> üçün telefon təsdiqi tələb olunur.
                        </div>
                        <div className="text-center text-[11px] text-gray-500">Seçilmiş rol: {roleTitle}</div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            Telefon nömrəsi
                          </label>
                          <PhoneInput value={phone} onChange={setPhone} required />
                        </div>
                        <Button type="submit" loading={loading} className="w-full justify-center py-3">
                          OTP göndər
                        </Button>
                      </form>
                    ) : null}

                    {step === 'teacher_otp' ? (
                      <form onSubmit={verifyTeacherOtp} className="space-y-4">
                        <p className="text-xs text-gray-400 text-center leading-relaxed">
                          Telefonunuza gələn <strong className="text-gray-200">6 rəqəmli OTP</strong> kodunu daxil edin.
                        </p>
                        <div className="text-center text-xs text-gray-500">{phone}</div>
                        <input
                          className="w-full bg-surface-1 border border-white/10 rounded-xl px-4 py-4 text-white text-2xl font-bold text-center tracking-widest outline-none focus:border-primary/40"
                          placeholder=""
                          aria-label="OTP kodu, 6 rəqəm"
                          maxLength={6}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                          required
                        />
                        <Button type="submit" loading={loading} className="w-full justify-center py-3">
                          Təsdiqlə
                        </Button>
                        {otpSent ? (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={async () => {
                              try {
                                await sendOtp(phone, 'instructor')
                                toast('OTP yenidən göndərildi', 'success')
                              } catch (e) {
                                toast(e?.message || 'OTP göndərilmədi', 'error')
                              }
                            }}
                            className="w-full text-center text-xs text-gray-500 hover:text-white disabled:opacity-50"
                          >
                            OTP yenidən göndər
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="w-full text-center text-xs text-gray-500 hover:text-white"
                          onClick={() => {
                            setStep('teacher_phone')
                            setOtpCode('')
                          }}
                        >
                          ← Geri
                        </button>
                      </form>
                    ) : null}
                  </>
                ) : null}

                {mode === 'phone' ? (
                  <>
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      {ROLES.map((r) => (
                        <button
                          key={r.key}
                          type="button"
                          onClick={() => {
                            setRole(r.key)
                            resetFlow()
                            setPhone('')
                          }}
                          className={`p-3 rounded-xl border text-sm font-semibold transition-all flex flex-col items-center gap-1 ${
                            role === r.key
                              ? 'border-primary/30 bg-primary/10 text-primary'
                              : 'border-white/10 text-gray-400 hover:border-white/20'
                          }`}
                        >
                          <RoleIcon role={r.key} />
                          <span className="text-xs">{r.label}</span>
                        </button>
                      ))}
                    </div>

                    {role && step === 'phone' && (
                      <form onSubmit={handlePhoneContinue} className="space-y-4">
                        <p className="text-xs text-gray-500 leading-relaxed">
                          Bu giriş <strong className="text-gray-300">yalnız mövcud hesablar</strong> üçündür. PIN yoxdursa,
                          &quot;Davam et&quot; ilə bir dəfə SMS göndərilir — gələn <strong className="text-gray-300">6 rəqəm</strong>{' '}
                          daimi giriş PIN-inizdir.
                        </p>
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            Telefon nömrəsi
                          </label>
                          <PhoneInput value={phone} onChange={setPhone} required />
                        </div>
                        <Button type="submit" loading={loading} className="w-full justify-center py-3">
                          Davam et
                        </Button>
                      </form>
                    )}

                    {role && step === 'pin' && (
                      <form onSubmit={handlePinLogin} className="space-y-4">
                        <p className="text-xs text-gray-400 text-center leading-relaxed">
                          SMS ilə gələn və ya əvvəl saxladığınız <strong className="text-gray-200">daimi 6 rəqəmli PIN</strong>{' '}
                          daxil edin. Bu, OTP deyil — hər girişdə eyni PIN.
                        </p>
                        <div className="text-center text-xs text-gray-500">{phone}</div>
                        <input
                          className="w-full bg-surface-1 border border-white/10 rounded-xl px-4 py-4 text-white text-2xl font-bold text-center tracking-widest outline-none focus:border-primary/40"
                          placeholder=""
                          aria-label="Giriş PIN-i, 6 rəqəm"
                          maxLength={6}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          value={pinInput}
                          onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                          required
                        />
                        <Button type="submit" loading={loading} className="w-full justify-center py-3">
                          PIN ilə daxil ol
                        </Button>
                        <button
                          type="button"
                          onClick={handleForgotPinSms}
                          disabled={loading}
                          className="w-full text-center text-xs text-amber-400/90 hover:text-amber-300 disabled:opacity-50"
                        >
                          PIN-i unutdum — yeni PIN SMS (bir dəfə)
                        </button>
                        <button
                          type="button"
                          onClick={resetFlow}
                          className="w-full text-center text-xs text-gray-500 hover:text-white"
                        >
                          ← Geri
                        </button>
                      </form>
                    )}

                    <button
                      type="button"
                      className="w-full text-center text-xs text-gray-500 hover:text-white mt-4"
                      onClick={() => {
                        setRole(null)
                        setPhone('')
                        setPinInput('')
                        setStep('phone')
                        setOtpCode('')
                        setOtpSent(false)
                      }}
                    >
                      Rol seçiminə geri qayıt
                    </button>
                  </>
                ) : null}
              </>
            )}

            <a
              href="https://wa.me/994503066626"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 mt-6 py-3 px-4 rounded-xl bg-primary text-[#041018] text-sm font-semibold hover:brightness-95 transition-all shadow-lg shadow-primary/20"
            >
              Bizimlə əlaqə
            </a>
          </div>
        </div>
      </div>

      {demoOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Demo prevyu"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDemoOpen(false)
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="text-sm font-semibold text-white">Demo prevyu</div>
              <button
                type="button"
                className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5"
                onClick={() => setDemoOpen(false)}
              >
                Bağla
              </button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <p className="text-gray-400 text-xs leading-relaxed">
                Bu, real məlumat deyil — Mentorix görünüşünü təxmini göstərir.
              </p>
              <div className="rounded-xl border border-white/10 bg-[#151515] p-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-white/5 border border-white/5 p-2">
                  <div className="text-gray-500">Bugün</div>
                  <div className="text-white font-semibold mt-1">3 dərs</div>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/5 p-2">
                  <div className="text-gray-500">Gözləyən ödəniş</div>
                  <div className="text-amber-300 font-semibold mt-1">1</div>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/35 p-3 space-y-2">
                <div className="text-xs font-semibold text-gray-100">Davamiyyət (nümunə)</div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full w-[76%] rounded-full bg-gradient-to-r from-primary to-emerald-300/80" />
                </div>
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>Keçən həftə</span>
                  <span className="text-gray-300">76%</span>
                </div>
              </div>
              <button
                type="button"
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-[#041018] hover:brightness-95"
                onClick={() => {
                  setDemoOpen(false)
                  scrollToId('mx-login')
                }}
              >
                Demo kifayət — başlayaq
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
