import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useAuthStore from '../../hooks/useAuth'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import PhoneInput from '../../components/auth/PhoneInput'
import Brand from '../../components/common/Brand'

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
  const googleBtnRef = useRef(null)
  const [loading, setLoading] = useState(false)

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
    if (!googleBtnRef.current) return

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return
    const g = window.google
    if (!g?.accounts?.id) return

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
      googleBtnRef.current.innerHTML = ''
      g.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
        shape: 'pill',
      })

      // Mobile Safari / some layouts can make the GIS iframe ignore taps if layered.
      // Ensure the container is clickable and provide a fallback click handler.
      googleBtnRef.current.style.pointerEvents = 'auto'
    } catch {
      // ignore
    }
  }, [isAdmin, mode, step, googleLogin, toast])

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
    <div className="min-h-[100svh] bg-[#0b0b0b] flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
      <div className="w-full max-w-sm">
        <div className="bg-surface-2 border border-white/10 rounded-2xl p-6 sm:p-8">
          <div className="text-center mb-6 sm:mb-8">
            <div className="flex justify-center pt-1 pb-3 bg-transparent">
              <Brand size="login" />
            </div>
            <div className="text-gray-400 text-sm mt-1">Hesabınıza daxil olun</div>
          </div>

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
                      <div className="relative z-10 flex justify-center">
                        <div
                          ref={googleBtnRef}
                          className="pointer-events-auto inline-flex"
                          style={{ minHeight: 44, maxWidth: '100%', overflow: 'hidden' }}
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
    