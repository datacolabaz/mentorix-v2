import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../common/Button'
import useAuthStore from '../../hooks/useAuth'
import { useToast } from '../common/Toast'
import api from '../../lib/api'

const inputClass =
  'w-full bg-surface-1 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary/40'

/**
 * Email + şifrə ilə qeydiyyat / giriş / email təsdiqi (6 rəqəmli kod və ya link).
 */
export default function InstructorEmailAuth({ onSuccess }) {
  const toast = useToast()
  const { signupWithEmail, verifyEmailCode, resendVerificationEmail, requestPasswordReset, setSession } = useAuthStore()
  const navigate = useNavigate()

  const [tab, setTab] = useState('signup') // signup | login
  const [phase, setPhase] = useState('form') // form | verify
  const [loading, setLoading] = useState(false)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [role, setRole] = useState('student') // student | instructor | course

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await signupWithEmail({
        full_name: fullName,
        email,
        password,
        role,
      })
      setPhase('verify')
      toast('Təsdiq kodu və link emailinizə göndərildi', 'success')
    } catch (err) {
      toast(err.message || 'Qeydiyyat xətası', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await api.post('/auth/login/email', { email, password, role })
      if (data?.needs_role && data?.token && data?.user) {
        setSession(data.token, data.user)
        navigate('/onboarding/role', { replace: true })
        return
      }
      if (!data?.token || !data?.user) throw new Error(data?.message || 'Server cavabı etibarsızdır')
      setSession(data.token, data.user)
      onSuccess?.(data.user)
    } catch (err) {
      const code = err?.code || err?.response?.data?.code
      if (code === 'EMAIL_NOT_VERIFIED') {
        setPhase('verify')
        toast('Əvvəlcə emaili təsdiqləyin (kod və ya link)', 'error')
      } else {
        toast(err.message || 'Giriş xətası', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const r = await verifyEmailCode({ email, code: verifyCode })
      if (r?.token && r?.user) {
        setSession(r.token, r.user)
        if (r?.needs_role) {
          toast('Email təsdiqləndi! İndi rol seçin.', 'success')
          navigate('/onboarding/role', { replace: true })
          return
        }
        toast('Email təsdiqləndi! Daxil oldunuz.', 'success')
        onSuccess?.(r.user)
        return
      }
      toast('Email təsdiqləndi! İndi daxil ola bilərsiniz.', 'success')
      setTab('login')
      setPhase('form')
      setVerifyCode('')
    } catch (err) {
      toast(err.message || 'Kod yanlışdır və ya müddəti bitib', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!email.trim()) {
      toast('Email daxil edin', 'error')
      return
    }
    setLoading(true)
    try {
      const r = await resendVerificationEmail(email)
      toast(r?.message || 'Email yenidən göndərildi', 'success')
    } catch (err) {
      toast(err.message || 'Göndərilmədi', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    const em = String(email || '').trim()
    if (!em) {
      toast('Email daxil edin', 'error')
      return
    }
    setLoading(true)
    try {
      const r = await requestPasswordReset(em)
      toast(r?.message || 'Bərpa linki göndərildi (emaili yoxlayın)', 'success')
    } catch (err) {
      toast(err?.response?.data?.message || err?.message || 'Göndərilmədi', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (phase === 'verify') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-300 text-center leading-relaxed">
          <strong className="text-white">{email}</strong> ünvanına 6 rəqəmli kod və təsdiq linki göndərildi.
          Linkə klik edin və ya kodu aşağıya yazın.
        </p>
        <form onSubmit={handleVerifyCode} className="space-y-3">
          <input
            className={`${inputClass} text-center text-2xl font-bold tracking-[0.4em]`}
            placeholder="000000"
            maxLength={6}
            inputMode="numeric"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
            required
          />
          <Button type="submit" loading={loading} className="w-full justify-center">
            Kodu təsdiqlə
          </Button>
        </form>
        <button
          type="button"
          disabled={loading}
          onClick={() => void handleResend()}
          className="w-full text-center text-xs text-primary hover:brightness-110 disabled:opacity-50"
        >
          Emaili yenidən göndər
        </button>
        <button
          type="button"
          onClick={() => {
            setPhase('form')
            setTab('login')
          }}
          className="w-full text-center text-xs text-gray-500 hover:text-white"
        >
          Təsdiqlədikdən sonra giriş →
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          { key: 'student', label: 'Tələbə' },
          { key: 'instructor', label: 'Müəllim' },
          { key: 'course', label: 'Kurs' },
        ].map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRole(r.key)}
            className={[
              'px-3 py-2 rounded-xl border text-xs font-semibold transition-colors',
              role === r.key
                ? 'border-primary/60 bg-primary/10 text-white'
                : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10',
            ].join(' ')}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="flex rounded-xl border border-white/10 overflow-hidden text-sm font-semibold">
        <button
          type="button"
          className={`flex-1 py-2.5 ${tab === 'signup' ? 'bg-primary text-[#041018]' : 'text-gray-400 hover:bg-white/5'}`}
          onClick={() => setTab('signup')}
        >
          Qeydiyyat
        </button>
        <button
          type="button"
          className={`flex-1 py-2.5 ${tab === 'login' ? 'bg-primary text-[#041018]' : 'text-gray-400 hover:bg-white/5'}`}
          onClick={() => setTab('login')}
        >
          Giriş
        </button>
      </div>

      {tab === 'signup' ? (
        <form onSubmit={handleSignup} className="space-y-3">
          <input
            className={inputClass}
            placeholder="Ad Soyad"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <input
            type="email"
            className={inputClass}
            placeholder="Gmail / email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className={inputClass}
            placeholder="Şifrə (min. 8 simvol)"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <Button type="submit" loading={loading} className="w-full justify-center">
            Qeydiyyatdan keç
          </Button>
        </form>
      ) : (
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="email"
            className={inputClass}
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className={inputClass}
            placeholder="Şifrə"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" loading={loading} className="w-full justify-center">
            Daxil ol
          </Button>
          <button
            type="button"
            className="w-full text-xs font-semibold text-primary hover:text-primary/90 text-center"
            disabled={loading}
            onClick={handleForgotPassword}
          >
            Parolumu unutmuşam
          </button>
          <button
            type="button"
            className="w-full text-xs text-gray-500 hover:text-white text-center"
            onClick={() => {
              setPhase('verify')
            }}
          >
            Email təsdiq kodunu daxil et
          </button>
        </form>
      )}
    </div>
  )
}
