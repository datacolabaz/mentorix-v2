import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import useAuthStore from '../../hooks/useAuth'
import useUiStore from '../../hooks/useUi'
import Brand from '../../components/common/Brand'
import NavIcon from '../../components/common/NavIcon'
import AuthShell from '../../components/auth/AuthShell'
import PasswordLoginForm from '../../components/auth/PasswordLoginForm'
import PublicGoogleSignIn from '../../components/auth/PublicGoogleSignIn'
import { setPageSeo } from '../../lib/pageSeo'
import { consumeReturnAfterLogin, peekReturnAfterLogin, rememberReturnAfterLogin } from '../../lib/inviteReturn'
import { LOGIN_PORTALS, portalLandingPath } from '../../lib/loginPortals'

/**
 * /login/student · /login/instructor · /login/organization · /login/admin
 * Same Google and email/password sign-in as before, plus the portal id. The server checks the account's real
 * roles; this page only shows the result (cabinet redirect or the "no access" message).
 */
export default function PortalLogin() {
  const { portal: portalId } = useParams()
  const portal = LOGIN_PORTALS[String(portalId || '').toLowerCase()] || null
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = searchParams.get('next')
  const isDark = useUiStore((s) => s.theme) === 'dark'
  const setSession = useAuthStore((s) => s.setSession)
  const [options, setOptions] = useState({ password_login: false, loaded: false })
  const [denied, setDenied] = useState(null)

  useEffect(() => {
    let alive = true
    api
      .get('/public/auth-options')
      .then((d) => alive && setOptions({ password_login: d?.password_login === true, loaded: true }))
      .catch(() => alive && setOptions({ password_login: false, loaded: true }))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const n = String(next || '').trim()
    if (n.startsWith('/') && !n.startsWith('/login') && n !== '/register') rememberReturnAfterLogin(n)
  }, [next])

  useEffect(() => {
    if (!portal) return
    setPageSeo({
      title: `Mentorix — ${portal.title}`,
      description: portal.subtitle,
      canonicalPath: portal.path,
      breadcrumbs: [
        { name: 'Mentorix', path: '/' },
        { name: 'Giriş', path: '/login' },
        { name: portal.card, path: portal.path },
      ],
    })
  }, [portal])

  if (!portal) return <Navigate to="/login" replace />

  const title = t(portal.titleKey, { defaultValue: portal.title })
  const subtitle = t(portal.subtitleKey, { defaultValue: portal.subtitle })
  const showPassword = portal.passwordAlways || options.password_login
  const muted = isDark ? 'text-gray-400' : 'text-slate-500'
  const linkCls = isDark
    ? 'text-primary underline underline-offset-2 hover:no-underline'
    : 'text-emerald-700 underline underline-offset-2 hover:no-underline font-medium'

  const handleSuccess = async (data) => {
    setDenied(null)
    const user = { ...data.user, needs_phone_verification: false, needs_instructor_phone: false }
    setSession(data.token, user)
    const path = portalLandingPath(portal, { serverRedirect: data.redirect, next, stored: peekReturnAfterLogin() })
    consumeReturnAfterLogin()
    navigate(path, { replace: true })
  }

  /** Server said no: show the message, never open a cabinet. Returns true when handled. */
  const handleError = (err) => {
    if (err?.code !== 'PORTAL_ROLE_REQUIRED') return false
    setDenied({ message: err.message, canRegister: err.can_register === true })
    return true
  }

  const accentChip = isDark ? portal.accent.chipDark : portal.accent.chip

  return (
    <AuthShell backTo="/login" backLabel={t('auth.portals.back', { defaultValue: '← Giriş seçimi' })}>
      <div className="text-center space-y-3" data-testid={`portal-login-${portal.id}`}>
        <div className="flex justify-center">
          <Brand size="login" tone={isDark ? 'dark' : 'light'} />
        </div>
        <div className={['mx-auto w-11 h-11 rounded-2xl flex items-center justify-center', accentChip].join(' ')}>
          <NavIcon name={portal.icon} className="w-6 h-6" />
        </div>
        <div className={['h-0.5 w-10 mx-auto rounded-full', portal.accent.bar].join(' ')} aria-hidden />
        <h1 className={['text-lg font-bold', isDark ? 'text-white' : 'text-slate-900'].join(' ')}>{title}</h1>
        <p className={['text-sm leading-relaxed', muted].join(' ')}>{subtitle}</p>
      </div>

      {denied ? (
        <div
          role="alert"
          data-testid="portal-denied"
          className={[
            'mt-5 rounded-xl border px-3 py-3 text-sm space-y-2',
            isDark ? 'text-red-200 bg-red-500/10 border-red-500/25' : 'text-red-800 bg-red-50 border-red-200',
          ].join(' ')}
        >
          <p className="font-semibold">{denied.message}</p>
          <p className="text-xs leading-relaxed">
            {portal.id === 'instructor'
              ? t('auth.portals.deniedInstructorHint', {
                  defaultValue: 'Müəllim icazəsi admin və ya təşkilat təsdiqi ilə verilir. Hesabınızdakı başqa kabinetdən icazə sorğusu göndərə bilərsiniz.',
                })
              : t('auth.portals.deniedHint', { defaultValue: 'Hesabınıza uyğun giriş növünü seçin.' })}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <Link to="/login" className={linkCls}>
              {t('auth.portals.chooseAnother', { defaultValue: 'Başqa giriş seçimi' })}
            </Link>
            {denied.canRegister ? (
              <Link to="/register" className={linkCls}>
                {t('auth.portals.createAccount', { defaultValue: 'Hesab yarat' })}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {showPassword ? (
        <PasswordLoginForm
          mode={portal.id === 'admin' ? 'admin' : 'email'}
          idPrefix={portal.id}
          notice={portal.id === 'admin' ? t('auth.adminPasswordNotice') : null}
          extraBody={{ portal: portal.id }}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      ) : null}

      <PublicGoogleSignIn
        className="mt-6"
        label={t('auth.googleOnly.cta', { defaultValue: 'Google ilə davam et' })}
        context="signin"
        portal={portal.id}
        onSuccess={handleSuccess}
        onError={handleError}
      />

      <p className={['mt-5 text-center text-xs leading-relaxed', muted].join(' ')}>
        {t('auth.googleOnly.legalPrefix', { defaultValue: 'Davam etməklə' })}{' '}
        <Link to="/terms" className={linkCls}>
          {t('auth.googleOnly.terms', { defaultValue: 'İstifadə Şərtləri' })}
        </Link>{' '}
        {t('auth.googleOnly.and', { defaultValue: 'və' })}{' '}
        <Link to="/privacy" className={linkCls}>
          {t('auth.googleOnly.privacy', { defaultValue: 'Məxfilik Siyasəti' })}
        </Link>{' '}
        {t('auth.googleOnly.legalSuffix', { defaultValue: 'ilə razılaşırsınız.' })}
      </p>
    </AuthShell>
  )
}
