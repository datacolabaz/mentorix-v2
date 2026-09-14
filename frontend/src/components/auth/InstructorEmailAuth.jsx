import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import GoogleSignInButton from './GoogleSignInButton'
import AuthAccountExistsModal from './AuthAccountExistsModal'
import Button from '../common/Button'
import useAuthStore from '../../hooks/useAuth'
import { useToast } from '../common/Toast'
import api from '../../lib/api'
import { getAttributionPayload } from '../../lib/analytics'
import { postAuthNavigate } from '../../lib/postAuth'
import { googleAuthWithAutoRole, googleSignup } from '../../lib/googleAuth'
import { loginWithEmailPassword } from '../../lib/emailLogin'
import { authLoggedInToastKey, authLoginErrorMessage } from '../../lib/authWelcomeToast'
import useUiStore from '../../hooks/useUi'

function authInputClass(isDark) {
  return [
    'mx-auth-input w-full rounded-xl px-4 py-3 text-sm outline-none border',
    isDark
      ? 'bg-surface-1 border-white/10 text-white placeholder:text-gray-500'
      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400',
  ].join(' ')
}

const AUTH_ROLE_KEYS = ['instructor', 'student', 'course', 'parent']

function useAuthRoles(keys) {
  const { t } = useTranslation()
  return useMemo(
    () => keys.map((key) => ({ key, label: t(`auth.roles.${key}`) })),
    [keys, t],
  )
}

function AuthDivider({ isDark }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3">
      <div className={`flex-1 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`} aria-hidden />
      <span className={`text-[11px] shrink-0 ${isDark ? 'text-gray-500' : 'text-slate-500'}`}>{t('auth.or')}</span>
      <div className={`flex-1 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`} aria-hidden />
    </div>
  )
}

function AuthModeTabs({ tab, onTab, isDark }) {
  const { t } = useTranslation()
  const idle = isDark
    ? 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
  return (
    <div className={`flex rounded-xl overflow-hidden text-sm font-semibold border ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
      <button
        type="button"
        className={`flex-1 py-2.5 transition-colors ${
          tab === 'login' ? 'bg-primary/15 text-primary' : idle
        }`}
        onClick={() => onTab('login')}
      >
        {t('auth.loginTabAction')}
      </button>
      <button
        type="button"
        className={`flex-1 py-2.5 transition-colors ${
          tab === 'signup' ? 'bg-primary/15 text-primary' : idle
        }`}
        onClick={() => onTab('signup')}
      >
        {t('auth.signupTabAction')}
      </button>
    </div>
  )
}

function PasswordVisibilityToggle({ visible, onToggle, labelShow, labelHide }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-gray-200"
      aria-label={visible ? labelHide : labelShow}
      onClick={onToggle}
    >
      {visible ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
          <path
            d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.5 10.5 0 0 1 12 5c5 0 9.3 3.1 11 7.5a11.7 11.7 0 0 1-4.2 5.1M6.1 6.1A11.7 11.7 0 0 0 1 12.5C2.7 16.9 7 20 12 20c1.4 0 2.7-.2 3.9-.7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
          <path
            d="M2 12.5C3.7 8.1 8 5 13 5s9.3 3.1 11 7.5C22.3 16.9 18 20 13 20S3.7 16.9 2 12.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx="13" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )}
    </button>
  )
}

function LoginPasswordInput({ value, onChange, inputClass, showPassword, onToggleVisibility }) {
  const { t } = useTranslation()
  return (
    <div className="relative">
      <input
        id="password"
        name="password"
        type={showPassword ? 'text' : 'password'}
        placeholder={t('auth.passwordPlaceholder')}
        autoComplete="current-password"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} touch-manipulation pr-11`}
        onFocus={(e) => {
          window.setTimeout(() => {
            try {
              e.target.scrollIntoView({ block: 'center', behavior: 'smooth' })
            } catch {
              /* ignore */
            }
          }, 400)
        }}
      />
      <PasswordVisibilityToggle
        visible={showPassword}
        onToggle={onToggleVisibility}
        labelShow={t('auth.showPassword')}
        labelHide={t('auth.hidePassword')}
      />
    </div>
  )
}

function RolePills({ roles, role, onRole, label, variant = 'grid' }) {
  const { t } = useTranslation()
  if (variant === 'pill') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-slate-500">{label}</p>
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
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
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
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300',
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
  const toast = useToast()
  const { signupWithEmail, verifyEmailCode, resendVerificationEmail, requestPasswordReset, setSession } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const nextParam = searchParams.get('next')
  const goAfterAuth = (u) => {
    if (onSuccess) onSuccess(u)
    else postAuthNavigate(u, navigate, nextParam)
  }
  const isDark = useUiStore((s) => s.theme) === 'dark'
  const inputClass = authInputClass(isDark)

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
  const [loginPassword, setLoginPassword] = useState('')
  const [loginRole, setLoginRole] = useState('instructor')
  const [loginRoleFallback, setLoginRoleFallback] = useState(false)
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [googleOnlyHint, setGoogleOnlyHint] = useState(false)

  const [signupFullName, setSignupFullName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [verifyEmail, setVerifyEmail] = useState('')
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
          ? await googleAuthWithAutoRole(
              credential,
              loginRoleFallback ? loginRole : null,
              loginPassword,
            )
          : await googleSignup(credential, signupPassword)
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
      if (!(r?.needs_onboarding || r?.needs_role)) {
        toast(t(authLoggedInToastKey(u)), 'success')
      }
      goAfterAuth(u)
    } catch (err) {
      if (tab === 'signup' && isAccountExistsError(err)) {
        openAccountExistsModal(err?.message)
      } else if (tab === 'login' && !loginRoleFallback && err?.status === 403) {
        setLoginRoleFallback(true)
        toast(t('auth.toasts.selectRoleRetry'), 'error')
      } else {
        toast(authLoginErrorMessage(err, t) || err?.message || t('auth.toasts.googleFailed'), 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await signupWithEmail({
        full_name: signupFullName,
        email: signupEmail,
        password: signupPassword,
        ...getAttributionPayload(),
      })
      if (data?.token && data?.user) {
        toast(t('auth.toasts.signupReadyLogin'), 'success')
        finishEmailLogin(data)
        return
      }
      const em = String(signupEmail || '').trim()
      setLoginEmail(em)
      pickTab('login')
      toast(t('auth.toasts.signupReadyLogin'), 'success')
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
    if (String(data?.user?.role || '').toLowerCase() === 'admin' && data?.token) {
      setSession(data.token, data.user)
      goAfterAuth(data.user)
      return
    }
    if ((data?.needs_onboarding || data?.needs_role) && data?.token && data?.user) {
      setSession(data.token, data.user)
      goAfterAuth(data.user)
      return
    }
    if (!data?.token || !data?.user) throw new Error(data?.message || t('auth.errors.invalidServer'))
    setSession(data.token, data.user)
    goAfterAuth(data.user)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const email = String(fd.get('email') || loginEmail || '').trim()
    const password = String(fd.get('password') || loginPassword || '').trim()
    if (!email) {
      toast(t('auth.toasts.enterEmail'), 'error')
      return
    }
    if (!password) {
      toast(t('auth.toasts.enterPassword'), 'error')
      return
    }
    setLoading(true)
    setGoogleOnlyHint(false)
    try {
      const data = await loginWithEmailPassword(
        api.post.bind(api),
        email,
        password,
        loginRoleFallback ? loginRole : null,
      )
      setLoginRoleFallback(false)
      if (data?.token && data?.user && !data?.needs_onboarding && !data?.needs_role) {
        toast(t(authLoggedInToastKey(data.user)), 'success')
      }
      finishEmailLogin(data)
    } catch (err) {
      if (!loginRoleFallback && err?.status === 403) {
        setLoginRoleFallback(true)
        toast(t('auth.toasts.selectRoleRetry'), 'error')
      } else if (err?.code === 'GOOGLE_LOGIN_REQUIRED') {
        setGoogleOnlyHint(true)
        toast(authLoginErrorMessage(err, t), 'error')
      } else {
        toast(authLoginErrorMessage(err, t), 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const r = await verifyEmailCode({ email: verifyEmail || signupEmail, code: verifyCode })
      if (r?.token && r?.user) {
        setSession(r.token, r.user)
      if (String(r.user?.role || '').toLowerCase() === 'admin') {
        toast(t('auth.toasts.loggedIn'), 'success')
        goAfterAuth(r.user)
        return
      }
      if (r?.needs_onboarding || r?.needs_role) {
        toast(t('auth.toasts.emailVerifiedChooseUse'), 'success')
        goAfterAuth(r.user)
        return
      }
        toast(t('auth.toasts.emailVerifiedLoggedIn'), 'success')
        goAfterAuth(r.user)
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
    const em = String(verifyEmail || signupEmail || loginEmail || '').trim()
    if (!em) {
      toast(t('auth.toasts.enterEmail'), 'error')
      return
    }
    setLoading(true)
    try {
      const r = await resendVerificationEmail(em)
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
        <p className={`text-sm text-center leading-relaxed ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
          {t('auth.verifySent', { email: verifyEmail || signupEmail })}
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
          className={`w-full text-center text-xs ${isDark ? 'text-gray-500 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
        >
          {t('auth.afterVerifyLogin')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <AuthModeTabs tab={tab} onTab={pickTab} isDark={isDark} />

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
            <LoginPasswordInput
              value={loginPassword}
              onChange={setLoginPassword}
              inputClass={inputClass}
              showPassword={showLoginPassword}
              onToggleVisibility={() => setShowLoginPassword((v) => !v)}
            />
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

          {googleOnlyHint ? (
            <div
              className={[
                'rounded-xl border px-3 py-2.5 text-xs leading-relaxed space-y-2',
                isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-100' : 'border-amber-200 bg-amber-50 text-amber-900',
              ].join(' ')}
              role="status"
            >
              <p>{t('auth.googleOnlyHint')}</p>
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleForgotPassword()}
                className="font-semibold text-primary hover:brightness-110 disabled:opacity-50"
              >
                {t('auth.setPasswordViaForgot')}
              </button>
            </div>
          ) : null}

          {loginRoleFallback ? (
            <div className="space-y-1.5">
              <label htmlFor="mx-login-role-fallback" className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
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

          <AuthDivider isDark={isDark} />

          <GoogleSignInButton
            key="login-google"
            onCredential={handleGoogleCredential}
            disabled={loading}
            label={t('auth.googleLogin')}
            context="signin"
          />
      </div>
      ) : (
      <div className="space-y-4">
          <p className={`text-sm text-center leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{t('auth.signupLead')}</p>

          <GoogleSignInButton
            key="signup-google"
            onCredential={handleGoogleCredential}
            disabled={loading}
            label={t('auth.googleContinue')}
            context="signup"
          />

          <AuthDivider isDark={isDark} />

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
            <div className="relative">
              <input
                id="mx-signup-password"
                name="new-password"
                type={showSignupPassword ? 'text' : 'password'}
                className={`${inputClass} pr-11`}
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
              <PasswordVisibilityToggle
                visible={showSignupPassword}
                onToggle={() => setShowSignupPassword((v) => !v)}
                labelShow={t('auth.showPassword')}
                labelHide={t('auth.hidePassword')}
              />
            </div>
            <Button type="submit" loading={loading} variant="secondary" className="w-full justify-center">
              {t('auth.signupSubmit')}
            </Button>
          </form>

          <p className={`text-xs text-center ${isDark ? 'text-gray-500' : 'text-slate-500'}`}>
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
