import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useAuthStore from '../../hooks/useAuth'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'

const ROLES = [
  { key: 'instructor', label: 'Müəllim', emoji: '👨‍🏫', otp: true },
  { key: 'student', label: 'Tələbə', emoji: '🎓', otp: true },
  { key: 'parent', label: 'Valideyn', emoji: '👪', otp: true },
]

export default function Login() {
  const [searchParams] = useSearchParams()
  const isAdmin = searchParams.get('admin') === 'true'
  const [role, setRole] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login, sendOtp, verifyOtp } = useAuthStore()
  const navigate = useNavigate()
  const toast = useToast()

  const roleMap = { admin: '/admin', instructor: '/instructor', student: '/student', parent: '/parent' }

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const user = await login(email, password)
      navigate(roleMap[user.role])
    } catch (err) {
      toast(err.message || 'Giriş xətası', 'error')
    } finally { setLoading(false) }
  }

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await sendOtp(phone)
      setOtpSent(true)
      toast('OTP göndərildi!')
    } catch (err) {
      toast(err.message || 'Xəta', 'error')
    } finally { setLoading(false) }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const user = await verifyOtp(phone, code)
      navigate(roleMap[user.role])
    } catch (err) {
      toast(err.message || 'Kod yanlışdır', 'error')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#0f0c29] grid-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-[#1a1740] border border-indigo-500/20 rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="font-display font-extrabold text-4xl bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">mentorix</div>
            <div className="text-gray-400 text-sm mt-2">Hesabınıza daxil olun</div>
          </div>

          {/* Admin login */}
          {isAdmin && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="text-xs text-center text-gray-500 mb-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">🔐 Admin Panel</div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">E-poçt</label>
                <input className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500"
                  type="email" placeholder="admin@mentorix.biz" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Şifrə</label>
                <input className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500"
                  type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" loading={loading} className="w-full justify-center py-3">Daxil ol →</Button>
            </form>
          )}

          {/* Normal login - OTP */}
          {!isAdmin && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {ROLES.map(r => (
                  <button key={r.key} onClick={() => { setRole(r.key); setOtpSent(false); setPhone(''); setCode('') }}
                    className={`p-3 rounded-xl border text-sm font-semibold transition-all flex flex-col items-center gap-1 ${
                      role === r.key ? 'border-blue-500 bg-blue-500/20 text-blue-300' : 'border-indigo-500/20 text-gray-400 hover:border-indigo-500/40 hover:text-white'
                    }`}>
                    <span className="text-xl">{r.emoji}</span>
                    <span className="text-xs">{r.label}</span>
                  </button>
                ))}
              </div>

              {role && !otpSent && (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Telefon nömrəsi</label>
                    <input className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500"
                      placeholder="+994XXXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} required />
                  </div>
                  <Button type="submit" loading={loading} className="w-full justify-center py-3">📱 OTP Göndər</Button>
                </form>
              )}

              {role && otpSent && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="text-center text-xs text-gray-400 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    ✓ {phone} nömrəsinə kod göndərildi
                  </div>
                  <input className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-4 text-white text-2xl font-bold text-center tracking-widest outline-none focus:border-blue-500"
                    placeholder="0000" maxLength={4} value={code} onChange={e => setCode(e.target.value)} required />
                  <Button type="submit" loading={loading} className="w-full justify-center py-3">✅ Daxil ol</Button>
                  <button type="button" onClick={() => setOtpSent(false)}
                    className="w-full text-center text-xs text-gray-500 hover:text-white transition-colors">← Geri</button>
                </form>
              )}
            </>
          )}

          <a href="https://wa.me/994503066626" target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 mt-6 py-2.5 px-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-semibold hover:bg-green-500/20 transition-colors">
            💬 Bizimlə əlaqə
          </a>
        </div>
      </div>
    </div>
  )
}
