import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useAuthStore from '../../hooks/useAuth'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import PhoneInput from '../../components/auth/PhoneInput'
import Brand from '../../components/common/Brand'
import api from '../../lib/api'
import { trackEvent } from '../../lib/analytics'
import { defaultLoginMarketingPayload } from '../../constants/defaultLoginMarketing'

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

/** Giriş ekranında göstərilən rollar (valideyn indi gizlədilib — lazım olanda əlavə et: { key: 'parent', label: 'Valideyn' }). */
const ROLES_LOGIN = [
  { key: 'instructor', label: 'Müəllim' },
  { key: 'student', label: 'Tələbə' },
]

const ROLE_LABELS = { instructor: 'Müəllim', student: 'Tələbə', parent: 'Valideyn' }

const TRUST_STUDENTS_FLOOR = 100
const TRUST_INSTRUCTORS_FLOOR = 15

/** Real sıralama boş olanda sahə tam boş görünməsin — aydın “prevyu” etiketi ilə */
const PREVIEW_TEACHERS = [
  {
    id: 'mx-preview-1',
    display_name: 'Leyla M.',
    student_count: 28,
    attendance_percent: 92,
    rating_stars: 4.5,
    preview: true,
  },
  {
    id: 'mx-preview-2',
    display_name: 'Rəşad K.',
    student_count: 19,
    attendance_percent: 88,
    rating_stars: 4,
    preview: true,
  },
  {
    id: 'mx-preview-3',
    display_name: 'Nərgiz Ə.',
    student_count: 34,
    attendance_percent: 95,
    rating_stars: 4.5,
    preview: true,
  },
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

/** İnam blokunda həmişə konkret mərtəbə — real rəqəm yoxdursa belə minimum göstəririk */
function trustCountWithFloor(raw, floor) {
  const v = Number(raw)
  const base = Number.isFinite(v) ? v : 0
  return Math.max(floor, base)
}

/** Marketinqdə “+500” kimi — “500+” yox */
function trustPlusCount(n) {
  return `+${formatAzInt(n)}`
}

function upliftLine(pct, loading) {
  if (loading) return '+30% daha yaxşı davamiyyət'
  if (pct == null || !Number.isFinite(Number(pct))) return '+30% daha yaxşı davamiyyət'
  const rounded = Math.round(Number(pct))
  if (rounded > 0) return `+${formatAzInt(rounded)}% daha yaxşı davamiyyət`
  if (rounded < 0) return `${formatAzInt(rounded)}% davamiyyət (əvvəlki aya nisbətən)`
  return '+30% daha yaxşı davamiyyət'
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
  const [step, setStep] = useState('google') // google | student_link_phone | student_link_otp | role | teacher_phone | teacher_otp | phone | pin
  const [googleCredential, setGoogleCredential] = useState(null)
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [linkOtpSent, setLinkOtpSent] = useState(false)
  /** Telefon bağlama ekranından «Müəllim» seçənlər üçün — tələbə rolu gizlədilir (təkrar hesab yaradılmır). */
  const [googleRoleExcludeStudent, setGoogleRoleExcludeStudent] = useState(false)
  const googleBtnRef = useRef(null)
  const [loading, setLoading] = useState(false)

  /** Əsas CTA — modal; səhifə yüklənəndə / avtomatik açılmır */
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const loginModalPanelRef = useRef(null)

  const loginSectionRef = useRef(null)
  const landingSectionSeenRef = useRef(new Set())
  const [landingLoading, setLandingLoading] = useState(!isAdmin)
  const [landingStats, setLandingStats] = useState(null)
  const [demoOpen, setDemoOpen] = useState(false)
  const [demoTab, setDemoTab] = useState('overview')
  const [demoPaneBusy, setDemoPaneBusy] = useState(false)
  const [marketing, setMarketing] = useState(() => defaultLoginMarketingPayload())

  const whyCardsForLanding = useMemo(
    () => (marketing?.why?.cards || []).filter((c) => c.card_enabled !== false),
    [marketing],
  )

  const {
    login,
    phoneNextStep,
    forgotPinSms,
    pinLogin,
    googleLogin,
    googleComplete,
    googleLinkSendOtp,
    googleLinkVerify,
    sendOtp,
    verifyOtp,
  } = useAuthStore()
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
    if (!role) return '—'
    return ROLE_LABELS[role] || role
  }, [role])

  const googleRoleChoices = useMemo(() => {
    if (step === 'role' && googleRoleExcludeStudent) return ROLES_LOGIN.filter((x) => x.key !== 'student')
    return ROLES_LOGIN
  }, [step, googleRoleExcludeStudent])

  /** GIS: `initialize()` təkrarlananda xəbərdarlıq verir — callback ref ilə saxlayırıq, düymə üçün yalnız `renderButton` yenilənir */
  const googleSdkCallbackRef = useRef(null)
  googleSdkCallbackRef.current = async (resp) => {
    const cred = resp?.credential
    if (!cred) return toast('Google giriş alınmadı', 'error')
    setLoading(true)
    try {
      const r = await googleLogin(cred)
      if (r?.token && r?.user) {
        goDashboard(r.user.role)
        return
      }
      if (r?.needs_phone_link) {
        setGoogleCredential(cred)
        setStep('student_link_phone')
        setPhone('')
        setOtpCode('')
        setLinkOtpSent(false)
        setGoogleRoleExcludeStudent(false)
        return
      }
      if (r?.needs_role) {
        setGoogleCredential(cred)
        setGoogleRoleExcludeStudent(false)
        setStep('role')
        return
      }
      toast(r?.message || 'Giriş alınmadı', 'error')
    } catch (e) {
      toast(e?.message || 'Google giriş xətası', 'error')
    } finally {
      setLoading(false)
    }
  }

  const gisInitializedForClientRef = useRef(null)

  /** Yalnız login səhifəsindən çıxanda — GIS One Tap / daxili axını bağlayır; modal addımı cleanup-da `cancel()` çağırmaq klik axınını poza bilər */
  useEffect(() => {
    return () => {
      try {
        window.google?.accounts?.id?.cancel?.()
      } catch {
        /* ignore */
      }
      gisInitializedForClientRef.current = null
    }
  }, [])

  useEffect(() => {
    if (isAdmin) return undefined
    if (mode !== 'google') return undefined
    if (step !== 'google') return undefined

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return undefined

    let cancelled = false
    let ticks = 0
    let renderFailures = 0
    let buttonRendered = false

    const MAX_TICKS = 120
    const MAX_RENDER_FAILURES = 8

    const tryMount = () => {
      if (cancelled || buttonRendered) return false
      const el = googleBtnRef.current
      if (!el) return false

      const g = window.google
      if (!g?.accounts?.id) {
        return false
      }

      const buttonWidthPx = () => {
        const host = el.parentElement
        const avail = host?.clientWidth || el.clientWidth || document.documentElement.clientWidth || 320
        const padded = Math.max(0, Math.floor(avail))
        return Math.max(240, Math.min(320, padded))
      }

      try {
        if (gisInitializedForClientRef.current !== clientId) {
          g.accounts.id.initialize({
            client_id: clientId,
            callback: (resp) => {
              void googleSdkCallbackRef.current?.(resp)
            },
          })
          gisInitializedForClientRef.current = clientId
        }

        el.innerHTML = ''
        g.accounts.id.renderButton(el, {
          theme: 'outline',
          size: 'large',
          width: buttonWidthPx(),
          text: 'continue_with',
          shape: 'pill',
        })

        el.style.pointerEvents = 'auto'
        buttonRendered = true
        return true
      } catch {
        renderFailures += 1
        return renderFailures >= MAX_RENDER_FAILURES
      }
    }

    let iv = null
    iv = window.setInterval(() => {
      if (cancelled || buttonRendered) {
        if (iv) window.clearInterval(iv)
        return
      }
      ticks += 1
      const done = tryMount()
      if (done || ticks >= MAX_TICKS) {
        if (iv) window.clearInterval(iv)
      }
    }, 50)

    if (tryMount() && iv) {
      window.clearInterval(iv)
      iv = null
    }

    return () => {
      cancelled = true
      if (iv) window.clearInterval(iv)
      try {
        const el = googleBtnRef.current
        if (el) el.innerHTML = ''
      } catch {
        /* ignore */
      }
    }
  }, [isAdmin, mode, step, loginModalOpen])

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

  /** Admin-də saxlanan landing mətnləri — API olmadan yalnız defolt göstərilirdi */
  useEffect(() => {
    if (isAdmin) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.get('/public/marketing/login', { params: { _: Date.now() } })
        if (!cancelled && data?.success && data?.landing) setMarketing(data.landing)
      } catch {
        /* defolt marketing state qalır */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  useEffect(() => {
    if (!demoOpen) return
    setDemoPaneBusy(true)
    const id = window.setTimeout(() => setDemoPaneBusy(false), 400)
    return () => window.clearTimeout(id)
  }, [demoOpen, demoTab])

  useEffect(() => {
    if (isAdmin) return
    trackEvent('mx_public_landing_view', { path: typeof window !== 'undefined' ? window.location.pathname || '/login' : '/login' })
  }, [isAdmin])

  useEffect(() => {
    if (isAdmin || typeof IntersectionObserver === 'undefined') return
    const seen = landingSectionSeenRef.current
    const targets = []

    const obs = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue
          const id = en.target instanceof HTMLElement ? en.target.id : ''
          if (!id || seen.has(id)) continue
          seen.add(id)
          trackEvent('mx_landing_section_view', { section_id: id })
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' },
    )

    const ids = ['mx-demo-mini']
    if (marketing?.trust?.section_enabled !== false) ids.push('mx-trust')
    if (whyCardsForLanding.length > 0) ids.push('mx-why')
    ids.push('mx-top', 'mx-steps', 'mx-features')
    if (marketing?.use_case?.section_enabled !== false) {
      ids.push('mx-use-case')
    }
    ids.push('mx-faq', 'mx-cta', 'mx-login')
    for (const id of ids) {
      const el = typeof document !== 'undefined' ? document.getElementById(id) : null
      if (el) {
        obs.observe(el)
        targets.push(el)
      }
    }

    return () => {
      for (const el of targets) {
        try {
          obs.unobserve(el)
        } catch {
          /* ignore */
        }
      }
      obs.disconnect()
    }
  }, [isAdmin, marketing.use_case?.section_enabled, marketing.trust?.section_enabled, whyCardsForLanding.length])

  const trustStudentsShown = trustCountWithFloor(landingStats?.students_managed, TRUST_STUDENTS_FLOOR)
  const trustTeachersShown = trustCountWithFloor(landingStats?.instructor_count, TRUST_INSTRUCTORS_FLOOR)

  const topInstructorsRows = useMemo(() => {
    const real = landingStats?.top_instructors
    if (Array.isArray(real) && real.length > 0) return real.map((t) => ({ ...t, preview: false }))
    return PREVIEW_TEACHERS
  }, [landingStats])

  const topIsPreviewOnly = useMemo(() => topInstructorsRows.every((t) => t.preview), [topInstructorsRows])

  const closeLoginModal = () => setLoginModalOpen(false)

  const openLoginModal = (surface) => {
    trackEvent('mx_landing_cta_primary', { surface })
    setDemoOpen(false)
    setMode('google')
    setStep('google')
    setGoogleCredential(null)
    setRole(null)
    setPhone('')
    setPinInput('')
    setOtpCode('')
    setOtpSent(false)
    setLinkOtpSent(false)
    setGoogleRoleExcludeStudent(false)
    setLoginModalOpen(true)
  }

  const openDemoTracked = (surface) => {
    trackEvent('mx_landing_demo_open', { surface })
    setDemoTab('overview')
    setDemoOpen(true)
  }

  const onDemoTabTracked = (tabId) => {
    trackEvent('mx_landing_demo_tab', { tab: tabId })
    setDemoTab(tabId)
  }

  const closeDemoTracked = () => {
    trackEvent('mx_landing_demo_close')
    setDemoOpen(false)
  }

  const m = marketing

  const loginSubmitBtnClass =
    !isAdmin && loginModalOpen ? 'w-full min-h-[52px] justify-center py-4 text-base' : 'w-full justify-center py-3'

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

  const sendStudentLinkOtp = async (e) => {
    e.preventDefault()
    if (!googleCredential) return
    setLoading(true)
    try {
      await googleLinkSendOtp(googleCredential, phone)
      setLinkOtpSent(true)
      setStep('student_link_otp')
      setOtpCode('')
      toast('OTP göndərildi', 'success')
    } catch (err) {
      toast(err?.message || 'SMS göndərilmədi', 'error')
    } finally {
      setLoading(false)
    }
  }

  const verifyStudentLink = async (e) => {
    e.preventDefault()
    if (!googleCredential) return
    setLoading(true)
    try {
      await googleLinkVerify(googleCredential, phone, otpCode)
      goDashboard('student')
    } catch (err) {
      toast(err?.message || 'Təsdiq alınmadı', 'error')
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

  useEffect(() => {
    if (!loginModalOpen || isAdmin) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') closeLoginModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [loginModalOpen, isAdmin])

  useEffect(() => {
    if (!loginModalOpen || isAdmin) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [loginModalOpen, isAdmin])

  useEffect(() => {
    if (!loginModalOpen || isAdmin) return
    const id = window.requestAnimationFrame(() => {
      loginModalPanelRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(id)
  }, [loginModalOpen, isAdmin])

  return (
    <div className="min-h-[100svh] bg-[#0b0b0b]">
      {!isAdmin ? (
        <div className="w-full max-w-5xl mx-auto px-4 pt-10 sm:pt-14 pb-8 space-y-12 sm:space-y-16">
          <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8 sm:gap-10">
            <div className="max-w-xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-gray-300">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_12px_rgba(0,229,176,0.9)]" />
                {m.hero.pill}
              </div>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
                {m.hero.headline}
              </h1>
              <p className="text-gray-400 text-sm sm:text-base leading-relaxed">{m.hero.subheadline}</p>
              <div className="flex flex-col w-full max-w-xl gap-3 sm:flex-row sm:flex-wrap sm:gap-3">
                <button
                  type="button"
                  onClick={() => openLoginModal('hero')}
                  className="w-full sm:flex-1 sm:min-h-0 inline-flex justify-center items-center text-center rounded-xl bg-primary px-4 sm:px-5 py-3.5 min-h-[48px] text-xs sm:text-sm font-semibold text-[#041018] shadow-lg shadow-primary/20 hover:brightness-95 leading-snug"
                >
                  {m.hero.primary_cta_label}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    trackEvent('mx_landing_secondary_click', { action: 'how_it_works' })
                    scrollToId('mx-steps')
                  }}
                  className="w-full sm:w-auto sm:flex-initial inline-flex justify-center items-center rounded-xl border border-white/15 bg-white/5 px-5 py-3.5 min-h-[48px] text-sm font-semibold text-gray-100 hover:bg-white/10"
                >
                  {m.hero.secondary_how}
                </button>
                <button
                  type="button"
                  onClick={() => openDemoTracked('hero_demo_button')}
                  className="w-full sm:w-auto sm:flex-initial inline-flex justify-center items-center rounded-xl border border-white/10 px-5 py-3.5 min-h-[48px] text-sm font-semibold text-gray-300 hover:border-white/20 hover:text-white"
                >
                  {m.hero.secondary_demo}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  trackEvent('mx_landing_secondary_click', { action: 'existing_account_login' })
                  scrollToId('mx-login')
                }}
                className="text-left text-xs text-gray-500 hover:text-gray-300 underline underline-offset-4"
              >
                {m.hero.existing_account}
              </button>
            </div>

            <div
              id="mx-demo-mini"
              className="relative w-full sm:w-[340px] shrink-0 rounded-2xl border border-white/10 bg-gradient-to-br from-[#131313] to-[#0a0f12] p-4 shadow-[0_0_80px_-20px_rgba(0,229,176,0.35)] overflow-hidden"
            >
              <div className="absolute inset-x-8 -top-16 h-32 rounded-full bg-primary/25 blur-3xl" />
              <div className="relative space-y-3">
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>{m.mini_preview.title}</span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-gray-300 border border-white/10">
                    {m.mini_preview.badge}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-black/35 border border-white/10 px-2 py-2">
                    <div className="text-[10px] text-gray-500">{m.mini_preview.col1_label}</div>
                    <div
                      className={`text-sm font-semibold text-white tabular-nums ${landingLoading ? 'motion-safe:animate-pulse' : ''}`}
                    >
                      {trustPlusCount(trustStudentsShown)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-black/35 border border-white/10 px-2 py-2">
                    <div className="text-[10px] text-gray-500">{m.mini_preview.col2_label}</div>
                    <div className="text-sm font-semibold text-primary">{m.mini_preview.col2_value}</div>
                  </div>
                  <div className="rounded-xl bg-black/35 border border-white/10 px-2 py-2">
                    <div className="text-[10px] text-gray-500">{m.mini_preview.col3_label}</div>
                    <div className="text-sm font-semibold text-amber-300/90">{m.mini_preview.col3_value}</div>
                  </div>
                </div>
                <div className="rounded-xl bg-black/25 border border-white/10 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-gray-100">{m.mini_preview.calendar_title}</div>
                  </div>
                  <div
                    className={`grid gap-1 ${
                      (m.mini_preview.calendar_days?.length || 5) <= 5
                        ? 'grid-cols-5'
                        : 'grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))]'
                    }`}
                  >
                    {(m.mini_preview.calendar_days?.length ? m.mini_preview.calendar_days : ['Pn', 'Ç', 'Çr', 'Ca', 'Cm']).map((d) => (
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
                      {m.mini_preview.slot1_time}
                    </div>
                    <div className="h-8 flex-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-gray-400 px-2 flex items-center justify-center">
                      {m.mini_preview.slot2_time}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {m.trust?.section_enabled !== false ? (
          <section id="mx-trust" className="space-y-4 scroll-mt-8">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{m.trust.heading}</div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-surface-2/80 backdrop-blur-sm p-4 sm:p-5">
                <div
                  className={`text-sm text-gray-200 leading-snug font-medium tabular-nums ${landingLoading ? 'motion-safe:animate-pulse' : ''}`}
                >
                  {trustPlusCount(trustStudentsShown)} {m.trust.students_suffix}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-surface-2/80 backdrop-blur-sm p-4 sm:p-5">
                <div
                  className={`text-sm text-gray-200 leading-snug font-medium tabular-nums ${landingLoading ? 'motion-safe:animate-pulse' : ''}`}
                >
                  {trustPlusCount(trustTeachersShown)} {m.trust.instructors_suffix}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-surface-2/80 backdrop-blur-sm p-4 sm:p-5">
                <div
                  className={`text-sm text-gray-200 leading-snug font-medium ${landingLoading ? 'motion-safe:animate-pulse' : ''}`}
                >
                  {upliftLine(landingStats?.attendance_uplift_percent, landingLoading)}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">{m.trust.attendance_footnote}</div>
              </div>
            </div>
          </section>
          ) : null}

          {whyCardsForLanding.length > 0 ? (
          <section id="mx-why" className="space-y-4 scroll-mt-8">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{m.why.heading}</div>
            <div className="grid md:grid-cols-3 gap-3">
              {whyCardsForLanding.map((x, i) => (
                <div key={`why-${i}-${String(x.title).slice(0, 24)}`} className="rounded-2xl border border-white/10 bg-[#121212]/90 p-4 space-y-2">
                  <div className="text-sm font-semibold text-white">{x.title}</div>
                  <p className="text-xs text-gray-400 leading-relaxed">{x.body}</p>
                </div>
              ))}
            </div>
          </section>
          ) : null}

          <section id="mx-top" className="space-y-4 scroll-mt-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                  {m.top_teachers.heading}
                </div>
                <p className="text-sm text-gray-400 mt-1 max-w-2xl">
                  {topIsPreviewOnly ? (
                    <>
                      {m.top_teachers.preview_before}{' '}
                      <span className="text-gray-200 font-medium">{m.top_teachers.preview_emphasis}</span>{' '}
                      {m.top_teachers.preview_after}
                    </>
                  ) : (
                    <>{m.top_teachers.description_real}</>
                  )}
                </p>
              </div>
              {topIsPreviewOnly ? (
                <span className="self-start rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-100 shadow-sm shadow-amber-500/10">
                  Preview · nümunə
                </span>
              ) : null}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {topInstructorsRows.map((t) => (
                <div
                  key={t.id}
                  className={`rounded-2xl border bg-[#131313]/90 flex flex-col gap-2.5 relative overflow-hidden p-4 ${
                    t.preview ? 'border-amber-500/35 ring-1 ring-amber-500/25 pt-12' : 'border-white/10'
                  }`}
                >
                  {t.preview ? (
                    <>
                      <span className="absolute left-3 top-3 z-10 rounded-md border border-amber-400/55 bg-amber-500/25 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-50 shadow-sm shadow-amber-500/20">
                        Preview
                      </span>
                      <span className="absolute right-3 top-3 z-10 rounded-md border border-white/20 bg-black/70 px-2 py-1 text-[9px] font-semibold text-gray-200 backdrop-blur-sm">
                        nümunə
                      </span>
                    </>
                  ) : null}
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="text-sm font-semibold text-white truncate min-w-0">{t.display_name}</div>
                    <div className="text-[11px] text-gray-500 shrink-0">
                      {formatAzInt(t.student_count)} {m.top_teachers.pupil_suffix}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs min-w-0">
                    <div className="text-amber-300/95">
                      {t.rating_stars != null ? (
                        <>
                          ★ {Number(t.rating_stars).toFixed(1)}
                          <span className="text-gray-500"> / 5</span>
                        </>
                      ) : (
                        <span className="text-gray-500">{m.top_teachers.rating_fallback}</span>
                      )}
                    </div>
                    <div className="text-gray-500">
                      {t.attendance_percent != null ? `${formatAzInt(t.attendance_percent)}% davamiyyət` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="mx-steps" className="space-y-4 scroll-mt-8">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{m.steps.heading}</div>
            <div className="grid md:grid-cols-3 gap-3">
              {(m.steps.items || []).map((x, i) => (
                <div
                  key={`step-${i}-${String(x.step)}`}
                  className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/10 to-[#101010] p-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary border border-primary/30">
                      {x.step}
                    </span>
                    <div className="text-sm font-semibold text-white">{x.title}</div>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed pl-10">{x.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="mx-features" className="space-y-4 scroll-mt-8">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{m.features.heading}</div>
            <div className="grid md:grid-cols-3 gap-3">
              {(m.features.items || []).map((x, i) => (
                <div
                  key={`feat-${i}`}
                  className={`rounded-2xl border border-white/10 bg-gradient-to-br ${x.accent || 'from-sky-500/15'} to-[#101010] p-4 space-y-2`}
                >
                  <div className="text-sm font-semibold text-white">{x.title}</div>
                  <p className="text-xs text-gray-400 leading-relaxed">{x.body}</p>
                </div>
              ))}
            </div>
          </section>

          {m.use_case?.section_enabled !== false ? (
          <section id="mx-use-case" className="space-y-4 scroll-mt-8">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{m.use_case.heading}</div>
            <div className="rounded-2xl border border-white/10 bg-[#121212]/90 p-5 sm:p-6 space-y-4">
              <p className="text-sm text-gray-200 font-medium">{m.use_case.title_line}</p>
              <ul className="space-y-2 text-sm text-gray-400 leading-relaxed list-disc pl-5">
                {(m.use_case.bullets || []).map((b, i) => (
                  <li key={i}>
                    <span className="text-gray-200">{b.lead}</span> {b.rest}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  trackEvent('mx_landing_secondary_click', { action: 'use_case_to_faq' })
                  scrollToId('mx-faq')
                }}
                className="text-xs text-primary hover:brightness-110 font-semibold"
              >
                {m.use_case.faq_link}
              </button>
            </div>
          </section>
          ) : null}

          <section id="mx-faq" className="space-y-4 scroll-mt-8">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{m.faq.heading}</div>
            <div className="rounded-2xl border border-white/10 bg-surface-2/70 divide-y divide-white/10">
              {(m.faq.items || []).map((it, i) => (
                <details key={`faq-${i}`} className="group p-4 sm:p-5">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-100 list-none flex items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                    <span>{it.q}</span>
                    <span className="text-gray-500 text-lg leading-none group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <p className="mt-3 text-xs sm:text-sm text-gray-400 leading-relaxed">{it.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section id="mx-cta" className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-[#0e1412] to-[#0b0b0b] p-6 sm:p-8 scroll-mt-8">
            <div className="space-y-2 max-w-xl">
              <div className="text-lg sm:text-xl font-semibold text-white">{m.cta_band.heading}</div>
              <p className="text-sm text-gray-300 leading-relaxed">{m.cta_band.subtitle}</p>
            </div>
            <div className="flex flex-col w-full max-w-xl gap-3 mt-5 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => openLoginModal('cta_band')}
                className="w-full sm:flex-1 inline-flex justify-center items-center text-center rounded-xl bg-primary px-4 sm:px-5 py-3.5 min-h-[48px] text-xs sm:text-sm font-semibold text-[#041018] shadow-lg shadow-primary/30 ring-2 ring-primary/25 hover:brightness-95 leading-snug"
              >
                {m.hero.primary_cta_label}
              </button>
              <button
                type="button"
                onClick={() => {
                  trackEvent('mx_landing_secondary_click', { action: 'how_it_works' })
                  scrollToId('mx-steps')
                }}
                className="w-full sm:w-auto sm:flex-initial inline-flex justify-center items-center rounded-xl border border-white/20 bg-black/25 px-5 py-3.5 min-h-[48px] text-sm font-semibold text-gray-100 hover:bg-black/35"
              >
                {m.hero.secondary_how}
              </button>
              <button
                type="button"
                onClick={() => openDemoTracked('cta_band_demo_button')}
                className="w-full sm:w-auto sm:flex-initial inline-flex justify-center items-center rounded-xl border border-white/15 px-5 py-3.5 min-h-[48px] text-sm font-semibold text-gray-100 hover:bg-white/5"
              >
                {m.hero.secondary_demo}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {!isAdmin && loginModalOpen ? (
        <div
          role="presentation"
          className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-md"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeLoginModal()
          }}
        />
      ) : null}

      <div
        className={`flex justify-center ${
          isAdmin
            ? 'min-h-[100svh] items-start px-4 pb-10 pt-8 sm:items-center sm:pt-4'
            : loginModalOpen
              ? 'pointer-events-none fixed inset-0 z-[101] items-stretch justify-center px-0 py-0 sm:items-center sm:px-4 sm:py-6'
              : 'px-4 pb-14 pt-4'
        }`}
      >
        <div
          id="mx-login"
          ref={(node) => {
            loginSectionRef.current = node
            loginModalPanelRef.current = node
          }}
          tabIndex={!isAdmin && loginModalOpen ? -1 : undefined}
          role={!isAdmin && loginModalOpen ? 'dialog' : undefined}
          aria-modal={!isAdmin && loginModalOpen ? true : undefined}
          aria-labelledby={!isAdmin && loginModalOpen ? 'mx-login-modal-title' : undefined}
          className={`w-full max-w-sm scroll-mt-6 ${
            !isAdmin && loginModalOpen
              ? 'pointer-events-auto flex h-full max-h-full min-h-0 flex-col sm:h-auto sm:max-h-[min(92dvh,680px)]'
              : ''
          }`}
        >
          <div
            className={`flex min-h-0 flex-1 flex-col bg-surface-2 p-6 sm:p-8 ${
              !isAdmin && loginModalOpen
                ? 'min-h-[100dvh] overflow-y-auto overscroll-y-contain rounded-none border-0 shadow-2xl sm:min-h-0 sm:rounded-2xl sm:border sm:border-white/10'
                : 'rounded-2xl border border-white/10'
            }`}
          >
            {!isAdmin ? (
              loginModalOpen ? (
                <div className="relative mb-6 shrink-0 space-y-2 px-1 text-center">
                  <button
                    type="button"
                    aria-label="Bağla"
                    className="absolute right-0 top-0 z-10 flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 hover:bg-white/10 hover:text-white"
                    onClick={closeLoginModal}
                  >
                    <span aria-hidden className="text-xl leading-none">
                      ×
                    </span>
                  </button>
                  <h2 id="mx-login-modal-title" className="pr-10 text-lg font-semibold text-white sm:text-xl">
                    Mentorix-ə başla
                  </h2>
                  {step === 'google' && mode === 'google' ? (
                    <p className="text-sm leading-relaxed text-gray-400">
                      Google ilə daxil ol və dərhal başla. İlk 5 tələbəni pulsuz əlavə et.
                    </p>
                  ) : null}
                  {step === 'student_link_phone' || step === 'student_link_otp' ? (
                    <p className="text-sm leading-relaxed text-gray-400">
                      Tələbə hesabını müəllimin yaratdığı telefon nömrəsi ilə OTP təsdiqi ilə Google-a bağla.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="mb-5 text-center space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Giriş</div>
                  <div className="mt-1 text-sm font-semibold text-gray-200">Hesabına daxil ol</div>
                  {step === 'student_link_phone' || step === 'student_link_otp' ? (
                    <div className="mt-2 text-xs text-gray-400 leading-relaxed px-1">
                      Tələbə hesabını müəllimin yaratdığı telefon nömrəsi ilə OTP təsdiqi ilə Google-a bağla.
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-gray-500">
                      Əvvəlcə məhsulu yuxarıda gör — sonra qeydiyyatı rahat keç.
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="text-center mb-6 sm:mb-8">
                <div className="flex justify-center pt-1 pb-3 bg-transparent">
                  <Brand size="login" />
                </div>
                <div className="text-gray-400 text-sm mt-1">Hesabınıza daxil olun</div>
              </div>
            )}

            {!isAdmin ? (
              <div className={`flex justify-center ${loginModalOpen ? 'mb-5' : 'mb-6'}`}>
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
                        <div className="relative z-10 flex w-full min-w-0 justify-center">
                          <div
                            ref={googleBtnRef}
                            className="pointer-events-auto inline-flex max-w-full"
                            style={{ minHeight: loginModalOpen ? 48 : 44 }}
                          />
                        </div>
                        {loginModalOpen ? (
                          <div className="flex items-center gap-3 py-1" aria-hidden>
                            <div className="h-px flex-1 bg-white/15" />
                            <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">və ya</span>
                            <div className="h-px flex-1 bg-white/15" />
                          </div>
                        ) : null}
                        <div className="text-center">
                          <button
                            type="button"
                            className={
                              loginModalOpen
                                ? 'mx-auto flex min-h-[52px] w-full max-w-xs items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-gray-200 hover:bg-white/10 sm:min-h-[48px]'
                                : 'text-xs text-gray-400 underline underline-offset-4 hover:text-gray-200'
                            }
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
                        <div className="px-1 text-center text-[11px] leading-relaxed text-gray-500">
                          {loginModalOpen ? (
                            <>
                              Yeni hesab üçün Google ilə davam edin.
                              <br />
                              Mövcud hesabınız varsa telefonla daxil olun.
                            </>
                          ) : (
                            <>
                              Yeni hesab üçün <strong className="text-gray-300">Google</strong> ilə davam edin. Mövcud hesabınız varsa{' '}
                              <strong className="text-gray-300">Telefonla daxil ol</strong>.
                            </>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {step === 'student_link_phone' ? (
                      <form onSubmit={sendStudentLinkOtp} className="space-y-4">
                        <p className="text-sm text-gray-200 text-center leading-relaxed font-medium">
                          Müəllimin səni artıq sistemə əlavə edib? Telefon nömrəni daxil et və hesabını bağla
                        </p>
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            Telefon nömrəsi
                          </label>
                          <PhoneInput value={phone} onChange={setPhone} required />
                        </div>
                        <Button type="submit" loading={loading} className={loginSubmitBtnClass}>
                          OTP göndər
                        </Button>
                        <button
                          type="button"
                          className="w-full text-center text-xs text-primary hover:brightness-110 font-semibold"
                          onClick={() => {
                            setGoogleRoleExcludeStudent(true)
                            setStep('role')
                          }}
                        >
                          Müəlliməm — qeydiyyata davam et
                        </button>
                        <button
                          type="button"
                          className="w-full text-center text-xs text-gray-500 hover:text-white"
                          onClick={() => {
                            setStep('google')
                            setGoogleCredential(null)
                            setPhone('')
                            setOtpCode('')
                            setLinkOtpSent(false)
                          }}
                        >
                          ← Geri
                        </button>
                      </form>
                    ) : null}

                    {step === 'student_link_otp' ? (
                      <form onSubmit={verifyStudentLink} className="space-y-4">
                        <p className="text-xs text-gray-400 text-center leading-relaxed">
                          Telefonuna gələn <strong className="text-gray-200">6 rəqəmli OTP</strong> kodunu daxil et.
                          Təsdiqlədikdən sonra giriş <strong className="text-gray-200">yalnız Google ilə</strong> olacaq.
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
                        <Button type="submit" loading={loading} className={loginSubmitBtnClass}>
                          Təsdiqlə və daxil ol
                        </Button>
                        {linkOtpSent ? (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={async () => {
                              try {
                                await googleLinkSendOtp(googleCredential, phone)
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
                            setStep('student_link_phone')
                            setOtpCode('')
                          }}
                        >
                          ← Geri
                        </button>
                      </form>
                    ) : null}

                    {step === 'role' ? (
                      <div className="space-y-4">
                        <div className="text-center text-sm text-gray-300 font-semibold">Rol seçin</div>
                        {googleRoleExcludeStudent ? (
                          <p className="text-[11px] text-center text-amber-200/90 leading-relaxed px-1">
                            Tələbə hesabını telefonla bağlamaq üçün «Geri» ilə əvvəlki addıma qayıdın. Burada yalnız müəllim
                            qeydiyyatı davam edir.
                          </p>
                        ) : null}
                        <div className={`grid gap-3 ${googleRoleChoices.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                          {googleRoleChoices.map((r) => (
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
                            if (googleRoleExcludeStudent) {
                              setStep('student_link_phone')
                              setGoogleRoleExcludeStudent(false)
                            } else {
                              setStep('google')
                              setGoogleCredential(null)
                            }
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
                        <Button type="submit" loading={loading} className={loginSubmitBtnClass}>
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
                        <Button type="submit" loading={loading} className={loginSubmitBtnClass}>
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
                    <div className={`grid gap-3 mb-6 ${ROLES_LOGIN.length <= 2 ? 'grid-cols-2 max-w-[280px] mx-auto' : 'grid-cols-3'}`}>
                      {ROLES_LOGIN.map((r) => (
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
                        <Button type="submit" loading={loading} className={loginSubmitBtnClass}>
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
              className={`flex items-center justify-center gap-2 rounded-xl bg-primary text-[#041018] font-semibold shadow-lg shadow-primary/20 transition-all hover:brightness-95 ${
                !isAdmin && loginModalOpen ? 'mt-8 min-h-[52px] px-4 py-4 text-base' : 'mt-6 px-4 py-3 text-sm'
              }`}
              onClick={() => trackEvent('mx_landing_whatsapp_click')}
            >
              Bizimlə əlaqə
            </a>
          </div>
        </div>
      </div>

      {demoOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="İnteraktiv demo paneli"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDemoTracked()
          }}
        >
          <div className="w-full max-w-2xl max-h-[min(92dvh,800px)] flex flex-col rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl overflow-hidden shadow-black/50">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 bg-[#111] shrink-0">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">Demo — idarə paneli</div>
                <div className="text-[11px] text-gray-500">Nümunə vizual, real hesab deyil</div>
              </div>
              <button
                type="button"
                className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 shrink-0 min-h-[44px] min-w-[44px]"
                onClick={() => closeDemoTracked()}
              >
                Bağla
              </button>
            </div>

            <div className="flex gap-2 p-2 sm:p-2 border-b border-white/10 bg-[#101010] shrink-0 overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]">
              {[
                { id: 'overview', label: 'Bülgə' },
                { id: 'schedule', label: 'Təqvim' },
                { id: 'payments', label: 'Ödənişlər' },
                { id: 'attendance', label: 'Davamiyyət' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onDemoTabTracked(tab.id)}
                  className={`rounded-lg px-4 py-2.5 min-h-[44px] text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    demoTab === tab.id
                      ? 'bg-primary/20 text-primary border border-primary/35 shadow-[0_0_20px_-6px_rgba(0,229,176,0.6)]'
                      : 'text-gray-400 border border-transparent hover:bg-white/5 hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-h-0 flex flex-col bg-[#0b0b0b]">
              {demoPaneBusy ? (
                <div
                  className="absolute inset-0 z-20 flex items-center justify-center bg-[#0b0b0b]/70 backdrop-blur-[1px] motion-safe:transition-opacity motion-safe:duration-200"
                  aria-hidden
                >
                  <div className="h-9 w-9 rounded-full border-2 border-white/15 border-t-primary motion-safe:animate-spin" />
                </div>
              ) : null}

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <div key={demoTab} className="p-4 pb-3 space-y-4 text-sm animate-demo-enter">
                  {demoTab === 'overview' ? (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          ['Aktiv şagird', '24'],
                          ['Bu həftə dərs', '11'],
                          ['Gözləyən ödəniş', '2'],
                          ['SMS (ay)', '38'],
                        ].map(([k, v]) => (
                          <div
                            key={k}
                            className="rounded-xl border border-white/10 bg-[#151515] p-3 motion-safe:transition motion-safe:duration-300 motion-safe:hover:-translate-y-0.5"
                          >
                            <div className="text-[10px] text-gray-500">{k}</div>
                            <div className="text-lg font-semibold text-white mt-0.5 tabular-nums">{v}</div>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#151515] p-3 space-y-2 overflow-hidden">
                        <div className="text-xs font-semibold text-gray-200">Bu ay — yüklənmə ritmi</div>
                        <div className="flex items-end gap-1.5 h-24 pt-2">
                          {[40, 65, 35, 80, 55, 90, 48].map((h, i) => (
                            <div key={i} className="flex-1 flex flex-col justify-end group">
                              <div
                                className="w-full rounded-t-md bg-gradient-to-t from-primary/40 to-primary motion-safe:transition-all motion-safe:duration-500 motion-safe:group-hover:brightness-110 min-h-[10px]"
                                style={{ height: `${h}%` }}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-500">
                          <span>Həftə 1</span>
                          <span>aktivlik</span>
                          <span>Həftə 7</span>
                        </div>
                      </div>
                    </>
                  ) : null}

                  {demoTab === 'schedule' ? (
                    <div className="space-y-2">
                      {[
                        { t: '17:30', s: 'Riyaziyyat • 10-cu sinif', st: 'Təsdiqlənib', ok: true },
                        { t: '19:00', s: 'İngilis • hazırlıq', st: 'Gözləyir', ok: false },
                        { t: '20:15', s: 'Fizika • qrup', st: 'Təsdiqlənib', ok: true },
                      ].map((row) => (
                        <button
                          key={row.t + row.s}
                          type="button"
                          className="w-full text-left rounded-xl border border-white/10 bg-[#151515] px-3 py-3 flex gap-3 items-center min-h-[52px] hover:bg-white/[0.04] active:scale-[0.99] motion-safe:transition motion-safe:duration-150"
                        >
                          <div className="rounded-lg bg-primary/15 border border-primary/25 text-primary text-xs font-bold px-2 py-1.5 min-w-[52px] text-center shrink-0">
                            {row.t}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-gray-100 truncate">{row.s}</div>
                            <div className={`text-[11px] mt-0.5 ${row.ok ? 'text-emerald-400/90' : 'text-amber-300/95'}`}>{row.st}</div>
                          </div>
                          <span className="text-gray-600 text-lg shrink-0">›</span>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {demoTab === 'payments' ? (
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                      <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wide text-gray-500 bg-[#161616] px-3 py-2 border-b border-white/10">
                        <div className="col-span-5">Şagird</div>
                        <div className="col-span-4">Məbləğ</div>
                        <div className="col-span-3 text-right">Status</div>
                      </div>
                      {[
                        ['Aylan H.', '120 ₼', 'Ödənildi'],
                        ['Murad T.', '80 ₼', 'Gözləyir'],
                        ['Lacin V.', '200 ₼', 'Gecikir'],
                      ].map(([name, amt, st]) => (
                        <div
                          key={name}
                          className="grid grid-cols-12 gap-2 items-center px-3 py-3 border-b border-white/5 text-xs bg-[#121212]"
                        >
                          <div className="col-span-5 text-gray-200 font-medium truncate min-w-0">{name}</div>
                          <div className="col-span-4 text-gray-400 tabular-nums">{amt}</div>
                          <div className="col-span-3 text-right">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                                st === 'Ödənildi'
                                  ? 'border-emerald-500/35 text-emerald-300 bg-emerald-500/10'
                                  : st === 'Gözləyir'
                                    ? 'border-amber-500/35 text-amber-200 bg-amber-500/10'
                                    : 'border-red-500/30 text-red-300 bg-red-500/10'
                              }`}
                            >
                              {st}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {demoTab === 'attendance' ? (
                    <div className="space-y-3">
                      {[
                        ['Bu həftə', 82],
                        ['Keçən həftə', 76],
                        ['Ay ortalaması', 88],
                      ].map(([label, pct]) => (
                        <div key={label} className="rounded-xl border border-white/10 bg-[#151515] p-3">
                          <div className="flex justify-between text-xs text-gray-200 font-medium mb-2 gap-2">
                            <span className="truncate">{label}</span>
                            <span className="text-primary tabular-nums shrink-0">{pct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-300/85 motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="shrink-0 border-t border-white/10 bg-[#0a0a0a]/95 backdrop-blur-md px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3">
                <button
                  type="button"
                  className="w-full rounded-xl bg-primary px-4 py-4 min-h-[52px] text-xs sm:text-sm font-bold text-[#041018] shadow-lg shadow-primary/35 ring-2 ring-primary/30 hover:brightness-95 active:scale-[0.99] motion-safe:transition motion-safe:duration-150 leading-snug text-center"
                  onClick={() => openLoginModal('demo_modal_footer')}
                >
                  {m.hero.primary_cta_label}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
