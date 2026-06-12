import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GoogleSignInButton from './GoogleSignInButton'
import Button from '../common/Button'
import useAuthStore from '../../hooks/useAuth'
import { useToast } from '../common/Toast'
import api from '../../lib/api'
import { getAttributionPayload } from '../../lib/analytics'
import { postAuthNavigate } from '../../lib/postAuth'

const inputClass =
  'w-full bg-surface-1 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary/40'

const SIGNUP_ROLES = [
  { key: 'student', label: 'Tələbə' },
  { key: 'instructor', label: 'Müəllim' },
  { key: 'course', label: 'Kurs' },
]

const LOGIN_ROLES = [
  { key: 'instructor', label: 'Müəllim' },
  { key: 'student', label: 'Tələbə' },
  { key: 'course', label: 'Kurs' },
  { key: 'parent', label: 'Valideyn' },
]

function AuthDivider() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 border-t border-white/10" aria-hidden />
      <span className="text-[11px] text-gray-500 shrink-0">və ya</span>
      <div className="flex-1 border-t border-white/10" aria-hidden />
    </div>
  )
}

function AuthModeTabs({ tab, onTab }) {
  return (
    <div className="flex rounded-xl border border-white/10 overflow-hidden text-sm font-semibold">
      <button
        type="button"
        className={`flex-1 py-2.5 transition-colors ${
          tab === 'login' ? 'bg-primary/15 text-primary' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
        }`}
        onClick={() => onTab('login')}
      >
        Daxil ol
      </button>
      <button
        type="button"
        className={`flex-1 py-2.5 transition-colors ${
          tab === 'signup' ? 'bg-primary/15 text-primary' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
        }`}
        onClick={() => onTab('signup')}
      >
        Yeni qeydiyyat
      </button>
    </div>
  )
}

function RolePills({ roles, role, onRole, label = 'Rolunuzu seçin' }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <div
        className={`grid gap-2 ${roles.length > 3 ? 'grid-cols-2' : 'grid-cols-3'}`}
        role="radiogroup"
        aria-label="Rol seçimi"
      >
        {roles.map((r) => {
          const selected = role === r.key
          return (
            <button
              key={r.key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onRole(r.key)}
              className={[
                'rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors text-center min-h-[44px]',
                selected
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/20',
              ].join(' ')}
            >
              {r.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Email/Google giriş və qeydiyyat (girişdə rol seçimi mütləqdir).
 */
export default function InstructorEmailAuth({ onSuccess }) {
  const toast = useToast()
  const { signupWithEmail, verifyEmailCode, resendVerificationEmail, requestPasswordReset, setSession } = useAuthStore()
  const navigate = useNavigate()

  const [tab, setTab] = useState('login')
  const [phase, setPhase] = useState('form')
  const [loading, setLoading] = useState(false)

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginRole, setLoginRole] = useState('instructor')
  const [loginPasswordReady, setLoginPasswordReady] = useState(false)

  const [signupFullName, setSignupFullName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupRole, setSignupRole] = useState('student')
  const [verifyCode, setVerifyCode] = useState('')

  const handleGoogleCredential = async (credential) => {
    const role = tab === 'login' ? loginRole : signupRole
    setLoading(true)
    try {
      let r = await api.post('/auth/google/login', { credential, role })
      if (r?.needs_role || r?.needs_phone_link) {
        r = await api.post('/auth/google/complete', { credential, role })
      }
      if (!r?.token || !r?.user) {
        toast(r?.message || 'Google girişi tamamlanmadı', 'error')
        return
      }
      const u = {
        ...r.user,
        needs_phone_verification:
          r.user?.role === 'instructor'
            ? Boolean(r.needs_phone_verification ?? r.user?.needs_phone_verification ?? r.needs_instructor_phone)
            : false,
        needs_instructor_phone:
          r.user?.role === 'instructor' ? Boolean(r.needs_instructor_phone ?? r.user?.needs_instructor_phone) : false,
      }
      setSession(r.token, u)
      if (u.needs_phone_verification) {
        toast('Müəllim hesabı üçün mobil təsdiq addımına yönləndirilirsiniz', 'success')
      } else if (u.role === 'student') {
        toast('Tələbə kimi daxil oldunuz', 'success')
      } else {
        toast('Daxil oldunuz', 'success')
      }
      if (onSuccess) onSuccess(u)
      else postAuthNavigate(u, navigate)
    } catch (err) {
      toast(err?.message || 'Google girişi uğursuz', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await signupWithEmail({
        full_name: signupFullName,
        email: signupEmail,
        password: signupPassword,
        role: signupRole,
        ...getAttributionPayload(),
      })
      setPhase('verify')
      toast('Təsdiq kodu və link emailinizə göndərildi', 'success')
    } catch (err) {
      toast(err.message || 'Qeydiyyat xətası', 'error')
    } finally {
      setLoading(false)
    }
  }

  const finishEmailLogin = (data) => {
    if (data?.needs_role && data?.token && data?.user) {
      setSession(data.token, data.user)
      navigate('/onboarding/role', { replace: true })
      return
    }
    if (!data?.token || !data?.user) throw new Error(data?.message || 'Server cavabı etibarsızdır')
    setSession(data.token, data.user)
    if (onSuccess) onSuccess(data.user)
    else postAuthNavigate(data.user, navigate)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!loginRole) {
      toast('Giriş üçün rol seçin', 'error')
      return
    }
    setLoading(true)
    try {
      const data = await api.post('/auth/login/email', {
        email: loginEmail,
        password: loginPassword,
        role: loginRole,
      })
      finishEmailLogin(data)
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
      const r = await verifyEmailCode({ email: signupEmail, code: verifyCode })
      if (r?.token && r?.user) {
        setSession(r.token, r.user)
        if (r?.needs_role) {
          toast('Email təsdiqləndi! İndi rol seçin.', 'success')
          navigate('/onboarding/role', { replace: true })
          return
        }
        toast('Email təsdiqləndi! Daxil oldunuz.', 'success')
        if (onSuccess) onSuccess(r.user)
        else postAuthNavigate(r.user, navigate)
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
    if (!signupEmail.trim()) {
      toast('Email daxil edin', 'error')
      return
    }
    setLoading(true)
    try {
      const r = await resendVerificationEmail(signupEmail)
      toast(r?.message || 'Email yenidən göndərildi', 'success')
    } catch (err) {
      toast(err.message || 'Göndərilmədi', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    const em = String(loginEmail || '').trim()
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
          <strong className="text-white">{signupEmail}</strong> ünvanına 6 rəqəmli kod və təsdiq linki göndərildi.
        </p>
        <form onSubmit={handleVerifyCode} className="space-y-3" autoComplete="off">
          <input
            className={`${inputClass} text-center text-2xl font-bold tracking-[0.4em]`}
            placeholder="000000"
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
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
      <AuthModeTabs tab={tab} onTab={setTab} />

      {tab === 'login' ? (
        <div className="space-y-4" key="login-panel">
          <RolePills
            roles={LOGIN_ROLES}
            role={loginRole}
            onRole={setLoginRole}
            label="Hansı hesabla daxil olursunuz?"
          />

          <GoogleSignInButton onCredential={handleGoogleCredential} disabled={loading} label="Google ilə daxil ol" />

          <AuthDivider />

          <form
            key="mentorix-login-form"
            onSubmit={handleLogin}
            className="space-y-3"
            autoComplete="on"
            method="post"
            action="/login"
          >
            <input
              id="mx-login-username"
              name="username"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={inputClass}
              placeholder="E-poçt"
              autoComplete="username"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
            />
            <input
              id="mx-login-password"
              name="password"
              type="password"
              className={inputClass}
              placeholder="Şifrə"
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              readOnly={!loginPasswordReady}
              onFocus={() => setLoginPasswordReady(true)}
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
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
              Şifrəmi unutmuşam
            </button>
          </form>

          <p className="text-xs text-center text-gray-500">
            Hesabınız yoxdur?{' '}
            <button type="button" className="font-semibold text-primary hover:brightness-110" onClick={() => setTab('signup')}>
              Qeydiyyatdan keçin
            </button>
          </p>
        </div>
      ) : (
        <div className="space-y-4" key="signup-panel">
          <RolePills roles={SIGNUP_ROLES} role={signupRole} onRole={setSignupRole} />

          <GoogleSignInButton onCredential={handleGoogleCredential} disabled={loading} label="Google ilə davam et" />

          <AuthDivider />

          <form
            key="mentorix-signup-form"
            onSubmit={handleSignup}
            className="space-y-3"
            autoComplete="on"
            method="post"
            action="/signup"
          >
            <input
              id="mx-signup-fullname"
              name="name"
              className={inputClass}
              placeholder="Ad Soyad"
              autoComplete="name"
              value={signupFullName}
              onChange={(e) => setSignupFullName(e.target.value)}
              required
            />
            <input
              id="mx-signup-email"
              name="email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={inputClass}
              placeholder="E-poçt"
              autoComplete="email"
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
              required
            />
            <input
              id="mx-signup-password"
              name="new-password"
              type="password"
              className={inputClass}
              placeholder="Şifrə (min. 8 simvol)"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
              minLength={8}
              required
            />
            <Button type="submit" loading={loading} variant="secondary" className="w-full justify-center">
              Qeydiyyatdan keç
            </Button>
          </form>

          <p className="text-xs text-center text-gray-500">
            Hesabınız var?{' '}
            <button type="button" className="font-semibold text-primary hover:brightness-110" onClick={() => setTab('login')}>
              Daxil olun
            </button>
          </p>
        </div>
      )}
    </div>
  )
}
