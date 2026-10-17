import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import Button from '../common/Button'
import PasswordInput from '../common/PasswordInput'
import useUiStore from '../../hooks/useUi'
import { isValidAdminIdentifier } from '../../lib/adminLoginIdentifier'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * The existing email/password sign-in form, shared by the admin and portal screens.
 *   mode 'admin'  → POST /auth/login       { identifier, password }  (phone or email)
 *   mode 'email'  → POST /auth/login/email { email, password }
 * `extraBody` (e.g. { portal }) is sent as is; the server decides what the account may open.
 */
export default function PasswordLoginForm({
  mode = 'admin',
  idPrefix = 'admin',
  notice = null,
  extraBody = null,
  onSuccess,
  onError,
  submitLabel,
}) {
  const { t } = useTranslation()
  const isDark = useUiStore((s) => s.theme) === 'dark'
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [identifierError, setIdentifierError] = useState('')
  const [loginError, setLoginError] = useState('')

  const muted = isDark ? 'text-gray-400' : 'text-slate-500'
  const inputCls = [
    'mx-auth-input w-full rounded-xl px-4 py-3 text-sm outline-none border',
    isDark ? 'bg-surface-1 border-white/10 text-white placeholder:text-gray-500' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-500',
  ].join(' ')
  const idLabel = mode === 'admin' ? t('auth.phoneOrEmail') : t('auth.email', { defaultValue: 'Email' })
  const userId = `${idPrefix}-username`
  const passId = `${idPrefix}-password`
  const noticeId = `${idPrefix}-login-notice`
  const errorId = `${idPrefix}-login-error`

  const submit = async (e) => {
    e.preventDefault()
    setLoginError('')
    const value = identifier.trim()
    const valid = mode === 'admin' ? isValidAdminIdentifier(value) : EMAIL_RE.test(value)
    if (!valid) {
      setIdentifierError(mode === 'admin' ? t('auth.invalidPhoneOrEmail') : t('auth.invalidEmail', { defaultValue: 'Düzgün email ünvanı daxil edin.' }))
      return
    }
    setIdentifierError('')
    setLoading(true)
    try {
      const body =
        mode === 'admin'
          ? { identifier: value, password, ...(extraBody || {}) }
          : { email: value, password, ...(extraBody || {}) }
      const data = await api.post(mode === 'admin' ? '/auth/login' : '/auth/login/email', body)
      if (!data?.token || !data?.user) throw new Error(data?.message || t('auth.errors.invalidServer'))
      await onSuccess?.(data)
    } catch (err) {
      const handled = onError ? onError(err) : false
      if (!handled) setLoginError(err?.message || t('auth.loginError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 space-y-4"
      autoComplete="on"
      noValidate
      aria-describedby={notice ? noticeId : undefined}
    >
      {notice ? (
        <p
          id={noticeId}
          className={[
            'text-center text-xs leading-relaxed py-2 px-3 rounded-xl border',
            isDark ? 'text-gray-300 bg-white/[0.04] border-white/10' : 'text-slate-600 bg-slate-50 border-slate-200',
          ].join(' ')}
        >
          {notice}
        </p>
      ) : null}
      <div>
        <label className={['block text-xs font-semibold uppercase tracking-wider mb-2', muted].join(' ')} htmlFor={userId}>
          {idLabel}
        </label>
        <input
          id={userId}
          name="username"
          className={inputCls}
          type={mode === 'admin' ? 'text' : 'email'}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={idLabel}
          value={identifier}
          onChange={(e) => {
            setIdentifier(e.target.value)
            if (identifierError) setIdentifierError('')
          }}
          aria-invalid={identifierError ? true : undefined}
          aria-describedby={identifierError ? `${userId}-error` : undefined}
          required
        />
        {identifierError ? (
          <p id={`${userId}-error`} role="alert" className={['mt-1.5 text-xs', isDark ? 'text-red-300' : 'text-red-700'].join(' ')}>
            {identifierError}
          </p>
        ) : null}
      </div>
      <div>
        <label className={['block text-xs font-semibold uppercase tracking-wider mb-2', muted].join(' ')} htmlFor={passId}>
          {t('auth.password')}
        </label>
        <PasswordInput
          id={passId}
          name="password"
          className={inputCls}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby={loginError ? errorId : undefined}
          required
        />
      </div>
      {loginError ? (
        <p
          id={errorId}
          role="alert"
          className={[
            'text-center text-xs py-2 px-3 rounded-xl border',
            isDark ? 'text-red-300 bg-red-500/10 border-red-500/20' : 'text-red-700 bg-red-50 border-red-200',
          ].join(' ')}
        >
          {loginError}
        </p>
      ) : null}
      <Button type="submit" loading={loading} className="w-full justify-center py-3">
        {submitLabel || t('auth.login')}
      </Button>
    </form>
  )
}
