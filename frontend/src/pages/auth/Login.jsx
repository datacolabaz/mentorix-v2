import { useState } from 'react'
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

  const [flow, setFlow] = useState('phone')
  const [loading, setLoading] = useState(false)

  const { login, phoneNextStep, forgotPinSms, pinLogin } = useAuthStore()
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
        setFlow('pin')
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
    setFlow('phone')
    setPinInput('')
  }

  return (
    <div className="min-h-[100svh] bg-[#0b0b0b] flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
      <div className="w-full max-w-sm">
        <div className="bg-surface-2 border border-white/10 rounded-2xl p-6 sm:p-8">
          <div className="text-center mb-6 sm:mb-8">
            <div className="flex justify-center">
              <div className="px-4 py-4 rounded-2xl bg-[#1a1a1a] border border-white/10">
                <Brand imgClassName="h-[120px] w-auto drop-shadow-[0_10px_25px_rgba(0,0,0,0.6)]" />
              </div>
            </div>
            <div className="text-gray-400 text-sm mt-2">Hesabınıza daxil olun</div>
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

              {role && flow === 'phone' && (
                <form onSubmit={handlePhoneContinue} className="space-y-4">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    <strong className="text-gray-300">OTP yoxdur.</strong> PIN yoxdursa, &quot;Davam et&quot; ilə bir dəfə
                    SMS göndərilir — gələn <strong className="text-gray-300">6 rəqəm</strong> daimi giriş PIN-inizdir.
                    Sonrakı girişlərdə yalnız həmin PIN (əlavə SMS yox).
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

              {role && flow === 'pin' && (
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
            </>
          )}

          <a
            href="https://wa.me/994503066626"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 mt-6 py-3 px-4 rounded-xl bg-primary text-black text-sm font-semibold hover:brightness-95 transition-all shadow-lg shadow-primary/15"
          >
            Bizimlə əlaqə
          </a>
        </div>
      </div>
    </div>
  )
}
