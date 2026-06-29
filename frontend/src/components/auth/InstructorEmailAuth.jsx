import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import GoogleSignInButton from './GoogleSignInButton'
import AuthAccountExistsModal from './AuthAccountExistsModal'
import Button from '../common/Button'
import useAuthStore from '../../hooks/useAuth'
import { useToast } from '../common/Toast'
import api, { AUTH_REQUEST_TIMEOUT_MS } from '../../lib/api'
import { getAttributionPayload } from '../../lib/analytics'
import { postAuthNavigate } from '../../lib/postAuth'
import i18n from '../../i18n'

const inputClass =
  'mx-auth-input w-full bg-surface-1 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none'

const AUTH_ROLE_KEYS = ['instructor', 'student', 'course', 'parent']
const SIGNUP_ROLE_KEYS = ['instructor', 'student', 'parent', 'course']
const LOGIN_ROLE_TRY_ORDER = ['instructor', 'course', 'student', 'parent']

function useAuthRoles(keys) {
  const { t } = useTranslation()
  return useMemo(
    () => keys.map((key) => ({ key, label: t(`auth.roles.${key}`) })),
    [keys, t],
  )
}

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
  throw lastRoleError || new Error(i18n.t('auth.errors.selectAccountType'))
}

async function googleAuthWithAutoRole(credential, forcedRole) {
  const roles = forcedRole ? [forcedRole] : LOGIN_ROLE_TRY_ORDER
  let lastRoleError = null
  for (const role of roles) {
    try {
      let r = await api.post('/auth/google/login', { credential, role, intent: 'signin' })
      if (r?.needs_role || r?.needs_phone_link) {
        r = await api.post('/auth/google/complete', { credential, role, intent: 'signin' })
      }
      if (r?.token && r?.user) return r
      lastRoleError = new Error(r?.message || i18n.t('auth.errors.googleIncomplete'))
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
  throw lastRoleError || new Error(i18n.t('auth.errors.googleSelectRole'))
}

function AuthDivider() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 border-t border-white/10" aria-hidden />
      <span className="text-[11px] text-gray-500 shrink-0">{t('auth.or')}</span>
      <div className="flex-1 border-t border-white/10" aria-hidden />
    </div>
  )
}

function AuthModeTabs({ tab, onTab }) {
  const { t } = useTranslation()
  return (
    <div className="flex rounded-xl border border-white/10 overflow-hidden text-sm font-semibold">
      <button
        type="button"
        className={`flex-1 py-2.5 transition-colors ${
          tab === 'login' ? 'bg-primary/15 text-primary' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
        }`}
        onClick={() => onTab('login')}
      >
        {t('auth.loginTabAction')}
      </button>
      <button
        type="button"
        className={`flex-1 py-2.5 transition-colors ${
          tab === 'signup' ? 'bg-primary/15 text-primary' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
        }`}
        onClick={() => onTab('signup')}
      >
        {t('auth.signupTabAction')}
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
  const { t } = useTranslation()
  const ios = isIosLike()
  const shared = {
    ref: inputRef,
    id: 'password',
    name: 'password',
    placeholder: t('auth.passwordPlaceholder'),
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

function RolePills({ roles, role, onRole, label, variant = 'grid' }) {
  const { t } = useTranslation()
  if (variant === 'pill') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-400">{label}</p>
        <div className="mx-role-selector" role="radiogroup" aria-label={t('auth.chooseRole')}>
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
        aria-label={t('auth.chooseRole')}
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
export default function InstructorEmailAuth({ onSuccess, onTabChange, initialTab = 'login' }) {
  const { t } = useTranslation()
  const authRoleOptions = useAuthRoles(AUTH_ROLE_KEYS)
  const signupRoleOptions = useAuthRoles(SIGNUP_ROLE_KEYS)
  const toast = useToast()
  const { signupWithEmail, verifyEmailCode, resendVerificationEmail, requestPasswordReset, setSession } = useAuthStore()
  const navigate = useNavigate()

  const [tab, setTab] = useState(initialTab)
  const pickTab = (next) => {
    setTab(next)
    onTabChange?.(next)
  }

  useEffect(() => {
    setTab(initialTab)
    onTabChange?.(initialTab)
  }, [initialTab])
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
  const [accountExistsOpen, setAccountExistsOpen] = useState(false)
  const [accountExistsMessage, setAccountExistsMessage] = useState('')

  const openAccountExistsModal = (message) => {
    setAccountExistsMessage(message || t('auth.errors.accountExists'))
    setAccountExistsOpen(true)
  }

  const isAccountExistsError = (err) =>
    err?.status === 409 || err?.code === 'ACCOUNT_ALREADY_EXISTS'

  const handleGoogleCredential = async (credential) => {
    setLoading(true)
    try {
      const r =
        tab === 'login'
          ? await googleAuthWithAutoRole(credential, loginRoleFallback ? loginRole : null)
          : await api.post(
              '/auth/google/complete',
              {
                credential,
                role: signupRole,
                intent: 'signup',
              },
              { timeout: AUTH_REQUEST_TIMEOUT_MS },
            )
      if (!r?.token || !r?.user) {
        toast(r?.message || t('auth.errors.googleIncomplete'), 'error')
        return
      }
      const u = {
        ...r.user,
        needs_phone_verification: false,
        needs_instructor_phone: false,
      }
      setSession(r.token, u)
      if (u.role === 'student') {
        toast(t('auth.toasts.loggedInStudent'), 'success')
      } else {
        toast(t('auth.toasts.loggedIn'), 'success')
      }
      if (onSuccess) onSuccess(u)
      else postAuthNavigate(u, navigate)
    } catch (err) {
      if (tab === 'signup' && isAccountExistsError(err)) {
        openAccountExistsModal(err?.message)
      } else if (tab === 'login' && !loginRoleFallback && err?.status === 403) {
        setLoginRoleFallback(true)
        toast(t('auth.toasts.selectRoleRetry'), 'error')
      } else {
        toast(err?.message || t('auth.toasts.googleFailed'), 'error')
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
      toast(t('auth.toasts.verifySent'), 'success')
    } catch (err) {
      if (isAccountExistsError(err)) {
        openAccountExistsModal(err?.message)
      } else {
        toast(err.message || t('auth.toasts.signupError'), 'error')
      }
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
    if (!data?.token || !data?.user) throw new Error(data?.message || t('auth.errors.invalidServer'))
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
      toast(t('auth.toasts.enterEmail'), 'error')
      return
    }
    if (!password) {
      toast(t('auth.toasts.enterPassword'), 'error')
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
        toast(t('auth.toasts.verifyEmailFirst'), 'error')
      } else if (!loginRoleFallback && err?.status === 403) {
        setLoginRoleFallback(true)
        toast(t('auth.toasts.selectRoleRetry'), 'error')
      } else {
        toast(err.message || t('auth.toasts.loginError'), 'error')
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
          toast(t('auth.toasts.emailVerifiedChooseRole'), 'success')
          navigate('/onboarding/role', { replace: true })
          return
        }
        toast(t('auth.toasts.emailVerifiedLoggedIn'), 'success')
        if (onSuccess) onSuccess(r.user)
        else postAuthNavigate(r.user, navigate)
        return
      }
      toast(t('auth.toasts.emailVerifiedCanLogin'), 'success')
      pickTab('login')
      setPhase('form')
      setVerifyCode('')
    } catch (err) {
      toast(err.message || t('auth.toasts.invalidCode'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!signupEmail.trim()) {
      toast(t('auth.toasts.enterEmail'), 'error')
      return
    }
    setLoading(true)
    try {
      const r = await resendVerificationEmail(signupEmail)
      toast(r?.message || t('auth.toasts.resendOk'), 'success')
    } catch (err) {
      toast(err.message || t('auth.toasts.sendFailed'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    const em = String(loginEmail || '').trim()
    if (!em) {
      toast(t('auth.toasts.enterEmail'), 'error')
      return
    }
    setLoading(true)
    try {
      const r = await requestPasswordReset(em)
      toast(r?.message || t('auth.toasts.recoverySent'), 'success')
    } catch (err) {
      toast(err?.response?.data?.message || err?.message || t('auth.toasts.sendFailed'), 'error')
    } finally {
      setLoading(false)
    }
  }

  if (phase === 'verify') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-300 text-center leading-relaxed">
          {t('auth.verifySent', { email: signupEmail })}
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
            {t('auth.verifySubmit')}
          </Button>
        </form>
        <button
          type="button"
          disabled={loading}
          onClick={() => void handleResend()}
          className="w-full text-center text-xs text-primary hover:brightness-110 disabled:opacity-50"
        >
          {t('auth.resendEmail')}
        </button>
        <button
          type="button"
          onClick={() => {
            setPhase('form')
            pickTab('login')
          }}
          className="w-full text-center text-xs text-gray-500 hover:text-white"
        >
          {t('auth.afterVerifyLogin')}
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
              placeholder={t('auth.email')}
              autoComplete="username"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
            />
            <LoginPasswordInput inputRef={loginPasswordRef} />
            <Button type="submit" loading={loading} className="w-full justify-center">
              {t('auth.login')}
            </Button>
            <button
              type="button"
              className="w-full text-xs font-semibold text-primary hover:text-primary/90 text-center"
              disabled={loading}
              onClick={handleForgotPassword}
            >
              {t('auth.forgotPassword')}
            </button>
          </form>

          {loginRoleFallback ? (
            <div className="space-y-1.5">
              <label htmlFor="mx-login-role-fallback" className="text-xs font-medium text-gray-400">
                {t('auth.accountType')}
              </label>
              <select
                id="mx-login-role-fallback"
                value={loginRole}
                onChange={(e) => setLoginRole(e.target.value)}
                className={`${inputClass} py-2.5`}
              >
                {authRoleOptions.map((r) => (
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
            label={t('auth.googleLogin')}
            context="signin"
          />

          <p className="text-xs text-center text-gray-500">
            {t('auth.noAccount')}{' '}
            <button type="button" className="font-semibold text-primary hover:brightness-110" onClick={() => pickTab('signup')}>
              {t('auth.signupLink')}
            </button>
          </p>
      </div>
      ) : (
      <div className="space-y-4">
          <RolePills
            roles={signupRoleOptions}
            role={signupRole}
            onRole={setSignupRole}
            label={t('auth.whoAreYou')}
            variant="pill"
          />

          <GoogleSignInButton
            key="signup-google"
            onCredential={handleGoogleCredential}
            disabled={loading}
            label={t('auth.googleContinue')}
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
              placeholder={t('auth.fullName')}
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
              placeholder={t('auth.email')}
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
              placeholder={t('auth.passwordMin')}
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
              {t('auth.signupSubmit')}
            </Button>
          </form>

          <p className="text-xs text-center text-gray-500">
            {t('auth.hasAccount')}{' '}
            <button type="button" className="font-semibold text-primary hover:brightness-110" onClick={() => pickTab('login')}>
              {t('auth.loginLink')}
            </button>
          </p>
      </div>
      )}
      <AuthAccountExistsModal
        open={accountExistsOpen}
        onClose={() => setAccountExistsOpen(false)}
        message={accountExistsMessage}
      />
    </div>
  )
}
