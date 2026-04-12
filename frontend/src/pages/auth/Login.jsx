import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useAuthStore from '../../hooks/useAuth'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'

const ROLES = [
  { key: 'instructor', label: 'Müəllim', emoji: '👨‍🏫' },
  { key: 'student', label: 'Tələbə', emoji: '🎓' },
  { key: 'parent', label: 'Valideyn', emoji: '👪' },
]

/** PIN + admin email girişi (OTP yox — daimi PIN bir dəfə SMS) */
export default function Login() {
  const [searchParams] = useSearchParams()
  const isAdmin = searchParams.get('admin') === 'true'

  const [role, setRole] = useState(null)
  const [email, setEmail] = useState('')
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
      const user = await login(email, password)
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
    <div className="min-h-screen bg-[#0f0c29] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-[#1a1740] border border-indigo-500/20 rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="font-display font-extrabold text-4xl bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              mentorix
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
                  E-poçt
                </label>
                <input
                  className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500"
                  type="email"
                  placeholder="admin@mentorix.biz"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Şifrə
                </label>
                <input
                  className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500"
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
                        ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                        : 'border-indigo-500/20 text-gray-400 hover:border-indigo-500/40'
                    }`}
                  >
                    <span className="text-xl">{r.emoji}</span>
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
                    <input
                      className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500"
                      placeholder="+994XXXXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
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
                    className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-4 text-white text-2xl font-bold text-center tracking-widest outline-none focus:border-blue-500"
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
            className="flex items-center justify-center gap-2 mt-6 py-2.5 px-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-semibold"
          >
            Bizimlə əlaqə
          </a>
        </div>
      </div>
    </div>
  )
}
