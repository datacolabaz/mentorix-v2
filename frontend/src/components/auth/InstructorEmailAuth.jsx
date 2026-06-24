import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GoogleSignInButton from './GoogleSignInButton'
import Button from '../common/Button'
import useAuthStore from '../../hooks/useAuth'
import { useToast } from '../common/Toast'
import api from '../../lib/api'
import { getAttributionPayload } from '../../lib/analytics'
import { postAuthNavigate } from '../../lib/postAuth'

const inputClass =
  'mx-auth-input w-full bg-surface-1 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none'

const AUTH_ROLE_OPTIONS = [
  { key: 'instructor', label: 'Müəllim' },
  { key: 'student', label: 'Tələbə' },
  { key: 'course', label: 'Kurs' },
  { key: 'parent', label: 'Valideyn' },
]

const SIGNUP_ROLE_OPTIONS = [
  { key: 'instructor', label: 'Müəllim' },
  { key: 'student', label: 'Tələbə' },
  { key: 'parent', label: 'Valideyn' },
  { key: 'course', label: 'Kurs' },
]

const LOGIN_ROLE_TRY_ORDER = ['instructor', 'course', 'student', 'parent']

async function loginEmailWithAutoRole(email, password, forcedRole) {
  const roles = forcedRole ? [forcedRole] : LOGIN_ROLE_TRY_ORDER
  let lastRoleError = null
  for (const role of roles) {
    try {
      const data = await api.post('/auth/login/email', { email, password, role })
      return data
    } catch (err) {
      const status = err?.status
      if (status === 401 || err?.code === 'EMAIL_NOT_VERIFIED') throw err
      if (status === 403) {
        lastRoleError = err
        continue
      }
      throw err
    }
  }
  throw lastRoleError || new Error('Giriş üçün hesab növünü seçin')
}

async function googleAuthWithAutoRole(credential, forcedRole) {
  const roles = forcedRole ? [forcedRole] : LOGIN_ROLE_TRY_ORDER
  let lastRoleError = null
  for (const role of roles) {
    try {
      let r = await api.post('/auth/google/login', { credential, role })
      if (r?.needs_role || r?.needs_phone_link) {
        r = await api.post('/auth/google/complete', { credential, role })
      }
      if (r?.token && r?.user) return r
      lastRoleError = new Error(r?.message || 'Google girişi tamamlanmadı')
    } catch (err) {
      const status = err?.status
      if (status === 401) throw err
      if (status === 403) {
        lastRoleError = err
        continue
      }
      throw err
    }
  }
  throw lastRoleError || new Error('Google girişi üçün hesab növünü seçin')
}

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

function isIosLike() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/i.test(ua)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

/**
 * Desktop: type=password + standart id/name — Chrome/Edge autofill cütü tanıyır.
 * iOS Safari: type=text + mask — Keychain overlay hər hərfdə bloklamasın.
 */
function LoginPasswordInput({ inputRef }) {
  const ios = isIosLike()
  const shared = {
    ref: inputRef,
    id: 'password',
    name: 'password',
    placeholder: 'Şifrə',
    autoComplete: 'current-password',
    autoCapitalize: 'off',
    autoCorrect: 'off',
    spellCheck: false,
    enterKeyHint: 'go',
    defaultValue: '',
    onFocus: (e) => {
      window.setTimeout(() => {
        try {
          e.target.scrollIntoView({ block: 'center', behavior: 'smooth' })
        } catch {
          /* ignore */
        }
      }, 400)
    },
  }

  if (ios) {
    return (
      <input
        {...shared}
        type="text"
        inputMode="text"
        className={`${inputClass} mx-login-password-mask touch-manipulation`}
      />
    )
  }

  return (
    <input
      {...shared}
      type="password"
      className={`${inputClass} touch-manipulation`}
    />
  )
}

function RolePills({ roles, role, onRole, label = 'Rolunuzu seçin', variant = 'grid' }) {
  if (variant === 'pill') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-400">{label}</p>
        <div className="mx-role-selector" role="radiogroup" aria-label="Rol seçimi">
          {roles.map((r) => {
            const selected = role === r.key
            return (
              <button
                key={r.key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onRole(r.key)}
                className={`mx-role-btn${selected ? ' mx-role-btn--active' : ''}`}
              >
                {r.label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

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
 * Email/Google giriş və qeydiyyat (girişdə rol avtomatik tapılır; yalnız uğursuzluqda dropdown).
 */
export default function InstructorEmailAuth({ onSuccess, onTabChange }) {
  const toast = useToast()
  const { signupWithEmail, verifyEmailCode, resendVerificationEmail, requestPasswordReset, setSession } = useAuthStore()
  const navigate = useNavigate()

  const [tab, setTab] = useState('login')
  const pickTab = (next) => {
    setTab(next)
    onTabChange?.(next)
  }
  const [phase, setPhase] = useState('form')
  const [loading, setLoading] = useState(false)

  const [loginEmail, setLoginEmail] = useState('')
  const [loginRole, setLoginRole] = useState('instructor')
  const [loginRoleFallback, setLoginRoleFallback] = useState(false)
  const loginPasswordRef = useRef(null)

  const [signupFullName, setSignupFullName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupRole, setSignupRole] = useState('instructor')
  const [verifyCode, setVerifyCode] = useState('')

  const handleGoogleCredential = async (credential) => {
    setLoading(true)
    try {
      const r =
        tab === 'login'
          ? await googleAuthWithAutoRole(credential, loginRoleFallback ? loginRole : null)
          : await (async () => {
              let out = await api.post('/auth/google/login', { credential, role: signupRole })
              if (out?.needs_role || out?.needs_phone_link) {
                out = await api.post('/auth/google/complete', { credential, role: signupRole })
              }
              return out
            })()
      if (!r?.token || !r?.user) {
        toast(r?.message || 'Google girişi tamamlanmadı', 'error')
        return
      }
      const u = {
        ...r.user,
        needs_phone_verification: false,
        needs_instructor_phone: false,
      }
      setSession(r.token, u)
      if (u.role === 'student') {
        toast('Tələbə kimi daxil oldunuz', 'success')
      } else {
        toast('Daxil oldunuz', 'success')
      }
      if (onSuccess) onSuccess(u)
      else postAuthNavigate(u, navigate)
    } catch (err) {
      if (tab === 'login' && !loginRoleFallback && err?.status === 403) {
        setLoginRoleFallback(true)
        toast('Hesab növünü seçib yenidən cəhd edin', 'error')
      } else {
        toast(err?.message || 'Google girişi uğursuz', 'error')
      }
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
    const form = e.currentTarget
    const fd = new FormData(form)
    const email = String(fd.get('email') || loginEmail || '').trim()
    const password = String(fd.get('password') || loginPasswordRef.current?.value || '')
    if (!email) {
      toast('Email daxil edin', 'error')
      return
    }
    if (!password) {
      toast('Şifrə daxil edin', 'error')
      return
    }
    setLoading(true)
    try {
      const data = await loginEmailWithAutoRole(
        email,
        password,
        loginRoleFallback ? loginRole : null,
      )
      setLoginRoleFallback(false)
      finishEmailLogin(data)
    } catch (err) {
      const code = err?.code || err?.response?.data?.code
      if (code === 'EMAIL_NOT_VERIFIED') {
        setPhase('verify')
        toast('Əvvəlcə emaili təsdiqləyin (kod və ya link)', 'error')
      } else if (!loginRoleFallback && err?.status === 403) {
        setLoginRoleFallback(true)
        toast('Hesab növünü seçib yenidən cəhd edin', 'error')
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
      pickTab('login')
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
            pickTab('login')
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
      <AuthModeTabs tab={tab} onTab={pickTab} />

      {tab === 'login' ? (
      <div className="space-y-4">
          <form
            id="mentorix-login-form"
            onSubmit={handleLogin}
            method="post"
            action="/login"
            className="space-y-3"
            autoComplete="on"
          >
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={`${inputClass} touch-manipulation`}
              placeholder="E-poçt"
              autoComplete="username"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
            />
            <LoginPasswordInput inputRef={loginPasswordRef} />
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

          {loginRoleFallback ? (
            <div className="space-y-1.5">
              <label htmlFor="mx-login-role-fallback" className="text-xs font-medium text-gray-400">
                Hesab növü
              </label>
              <select
                id="mx-login-role-fallback"
                value={loginRole}
                onChange={(e) => setLoginRole(e.target.value)}
                className={`${inputClass} py-2.5`}
              >
                {AUTH_ROLE_OPTIONS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <AuthDivider />

          <GoogleSignInButton
            key="login-google"
            onCredential={handleGoogleCredential}
            disabled={loading}
            label="Google ilə daxil ol"
            context="signin"
          />

          <p className="text-xs text-center text-gray-500">
            Hesabınız yoxdur?{' '}
            <button type="button" className="font-semibold text-primary hover:brightness-110" onClick={() => pickTab('signup')}>
              Qeydiyyatdan keçin
            </button>
          </p>
      </div>
      ) : (
      <div className="space-y-4">
          <RolePills
            roles={SIGNUP_ROLE_OPTIONS}
            role={signupRole}
            onRole={setSignupRole}
            label="Siz kimsiniz?"
            variant="pill"
          />

          <GoogleSignInButton
            key="signup-google"
            onCredential={handleGoogleCredential}
            disabled={loading}
            label="Google ilə davam et"
            context="signup"
          />

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
            <button type="button" className="font-semibold text-primary hover:brightness-110" onClick={() => pickTab('login')}>
              Daxil olun
            </button>
          </p>
      </div>
      )}
    </div>
  )
}
