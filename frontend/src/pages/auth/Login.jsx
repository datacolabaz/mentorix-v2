import { useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useAuthStore from '../../hooks/useAuth'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'

const ROLES = [
  { key: 'instructor', label: 'Müəllim', emoji: '👨‍🏫' },
  { key: 'student', label: 'Tələbə', emoji: '🎓' },
  { key: 'parent', label: 'Valideyn', emoji: '👪' },
]

/** OTP / PIN / admin girişi */
export default function Login() {
  const [searchParams] = useSearchParams()
  const isAdmin = searchParams.get('admin') === 'true'

  const [role, setRole] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [pinInput, setPinInput] = useState('')
  const [newPin, setNewPin] = useState('')
  const [newPin2, setNewPin2] = useState('')

  /** phone | otp | pin | setpin */
  const [flow, setFlow] = useState('phone')
  const [otpSent, setOtpSent] = useState(false)
  const [forgotPin, setForgotPin] = useState(false)
  /** PIN unut → OTP axını; state bəzən gecikə bilər, ref serverə düzgün flag göndərir */
  const otpAfterForgotRef = useRef(false)
  /** true = SMS kodu PIN kimi saxlanılmasın, əl ilə PIN ekranı göstər */
  const [useSeparatePin, setUseSeparatePin] = useState(false)
  const [loading, setLoading] = useState(false)

  const { login, phoneNextStep, sendOtp, verifyOtp, pinLogin, setPin } = useAuthStore()
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

  /** Rol + telefon → server deyir: OTP və ya PIN */
  const handlePhoneContinue = async (e) => {
    e.preventDefault()
    if (!role) return
    setLoading(true)
    try {
      const data = await phoneNextStep(phone, role)
      if (data.next === 'pin') {
        setFlow('pin')
        setOtpSent(false)
        setForgotPin(false)
        otpAfterForgotRef.current = false
        setOtpCode('')
        setPinInput('')
        toast(data.message || 'PIN ilə daxil olun', 'success')
      } else {
        setFlow('otp')
        setOtpSent(false)
        setOtpCode('')
        toast(data.message || 'OTP göndərin', 'success')
      }
    } catch (err) {
      toast(err.message || 'Xəta', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSendOtp = async (e) => {
    e?.preventDefault()
    if (!role) return
    setLoading(true)
    try {
      await sendOtp(phone, role)
      setOtpSent(true)
      toast('OTP SMS ilə göndərildi')
    } catch (err) {
      toast(err.message || 'OTP göndərilmədi', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (!role) return
    setLoading(true)
    try {
      const fromForgot = otpAfterForgotRef.current
      const data = await verifyOtp(phone, otpCode, role, {
        ...(useSeparatePin ? { saveOtpAsPin: false } : {}),
        ...(fromForgot ? { forgotPinReset: true } : {}),
      })
      otpAfterForgotRef.current = false
      if (data.needs_pin_setup || data.pin_was_reset) {
        setFlow('setpin')
        setNewPin('')
        setNewPin2('')
        toast(
          data.pin_was_reset || fromForgot
            ? 'Təsdiq olundu. İndi yeni 6 rəqəmli PIN təyin edin'
            : 'Növbəti girişlər üçün özünüzə 6 rəqəmli PIN təyin edin',
          'success'
        )
        setForgotPin(false)
      } else {
        goDashboard(data.user.role)
      }
    } catch (err) {
      toast(err.message || 'Kod yanlışdır', 'error')
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
      if (err.needs_otp) toast(err.message || 'Əvvəlcə OTP', 'error')
      else toast(err.message || 'PIN yanlışdır', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSetPin = async (e) => {
    e.preventDefault()
    if (newPin !== newPin2) {
      toast('PIN-lər eyni deyil', 'error')
      return
    }
    if (!/^\d{6}$/.test(newPin)) {
      toast('Tam 6 rəqəm', 'error')
      return
    }
    setLoading(true)
    try {
      await setPin(newPin)
      const { user } = useAuthStore.getState()
      toast('PIN saxlanıldı')
      if (user?.role) goDashboard(user.role)
    } catch (err) {
      toast(err.message || 'Xəta', 'error')
    } finally {
      setLoading(false)
    }
  }

  const resetFlow = () => {
    setFlow('phone')
    setOtpSent(false)
    setOtpCode('')
    setPinInput('')
    setForgotPin(false)
    otpAfterForgotRef.current = false
    setUseSeparatePin(false)
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
                    İlk giriş və ya admin tərəfindən əlavə olunmuş hesab üçün nömrəni təsdiqləmək OTP lazımdır.
                    PIN təyin etdikdən sonra növbəti girişlər pulsuzdur (SMS yox).
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

              {role && flow === 'otp' && (
                <div className="space-y-4">
                  {!otpSent ? (
                    <>
                      {otpAfterForgotRef.current && (
                        <p className="text-xs text-center text-amber-200/90 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          OTP ilə təsdiqləyəndən sonra <strong>yeni PIN</strong> təyin edəcəksiniz. SMS kodunu PIN
                          sahəsinə yazmayın.
                        </p>
                      )}
                      <p className="text-xs text-gray-400 text-center">
                        Təhlükəsizlik üçün SMS OTP göndərilir (müəllim kotasından).
                      </p>
                      <Button
                        type="button"
                        loading={loading}
                        onClick={handleSendOtp}
                        className="w-full justify-center py-3"
                      >
                        OTP göndər
                      </Button>
                    </>
                  ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-4">
                      <div className="text-xs text-amber-200/90 leading-relaxed p-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
                        <strong className="text-amber-100">Necə işləyir:</strong> 6 rəqəmli kod təsdiqlənəndə o, avtomatik
                        olaraq <strong>növbəti girişləriniz üçün PIN</strong> kimi də saxlanılır — əlavə PIN ekranı
                        çıxmayacaq. Yalnız özünüz başqa PIN istəyirsinizsə, aşağıdakı qutu işarələyin.
                      </div>
                      <div className="text-center text-xs text-gray-400 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        {phone} nömrəsinə kod göndərildi
                      </div>
                      <input
                        className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-4 text-white text-2xl font-bold text-center tracking-widest outline-none focus:border-blue-500"
                        placeholder="000000"
                        maxLength={6}
                        inputMode="numeric"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        required
                      />
                      <label className="flex items-start gap-3 text-xs text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded border-indigo-500/40"
                          checked={useSeparatePin}
                          onChange={(e) => setUseSeparatePin(e.target.checked)}
                        />
                        <span>
                          Özüm <strong>ayrıca</strong> 6 rəqəmli PIN təyin edəcəyəm (SMS kodu daimi PIN olmasın)
                        </span>
                      </label>
                      <Button type="submit" loading={loading} className="w-full justify-center py-3">
                        Təsdiqlə
                      </Button>
                    </form>
                  )}
                  <button
                    type="button"
                    onClick={resetFlow}
                    className="w-full text-center text-xs text-gray-500 hover:text-white"
                  >
                    ← Geri
                  </button>
                </div>
              )}

              {role && flow === 'pin' && (
                <form onSubmit={handlePinLogin} className="space-y-4">
                  <p className="text-xs text-gray-400 text-center leading-relaxed">
                    Buraya <strong className="text-gray-200">SMS OTP kodunu yox</strong> — öz təyin etdiyiniz giriş
                    PIN-inizi yazın. OTP yalnız bir dəfəlik təsdiq üçündür.
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
                    onClick={() => {
                      setForgotPin(true)
                      otpAfterForgotRef.current = true
                      setFlow('otp')
                      setOtpSent(false)
                      setOtpCode('')
                    }}
                    className="w-full text-center text-xs text-amber-400/90 hover:text-amber-300"
                  >
                    Şifrəni unutmuşam — OTP göndər
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

              {role && flow === 'setpin' && (
                <form onSubmit={handleSetPin} className="space-y-4">
                  <p className="text-xs text-gray-400 text-center leading-relaxed">
                    Özünüzə <strong className="text-gray-300">6 rəqəmli PIN</strong> seçin və iki dəfə daxil edin.
                  </p>
                  {otpCode.length === 6 && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewPin(otpCode)
                        setNewPin2(otpCode)
                        toast('Sahələr SMS kodu ilə dolduruldu — təsdiq üçün "PIN saxla" basın', 'success')
                      }}
                      className="w-full text-xs py-2.5 px-3 rounded-xl border border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/10"
                    >
                      SMS OTP kodunu bu PIN kimi istifadə et (6 rəqəm)
                    </button>
                  )}
                  <input
                    className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-3 text-white text-lg text-center tracking-widest outline-none focus:border-blue-500"
                    placeholder="PIN (6 rəqəm)"
                    maxLength={6}
                    inputMode="numeric"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                  <input
                    className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-3 text-white text-lg text-center tracking-widest outline-none focus:border-blue-500"
                    placeholder="PIN təkrar"
                    maxLength={6}
                    inputMode="numeric"
                    value={newPin2}
                    onChange={(e) => setNewPin2(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                  <Button type="submit" loading={loading} className="w-full justify-center py-3">
                    PIN saxla və daxil ol
                  </Button>
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
