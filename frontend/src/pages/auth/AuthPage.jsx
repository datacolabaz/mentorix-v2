import { useEffect } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../../hooks/useAuth'
import Brand from '../../components/common/Brand'
import AuthShell from '../../components/auth/AuthShell'
import PasswordLoginForm from '../../components/auth/PasswordLoginForm'
import PublicGoogleSignIn from '../../components/auth/PublicGoogleSignIn'
import { setPageSeo } from '../../lib/pageSeo'
import { postAuthNavigate, rememberReturnAfterLogin } from '../../lib/postAuth'
import useUiStore from '../../hooks/useUi'

/**
 * Qeydiyyat (/register) və köhnə ümumi giriş görünüşü: istifadəçilər üçün yalnız «Google ilə davam et».
 * Admin (?admin=true və ya next=/admin...) üçün telefon/email + şifrə formu da göstərilir.
 * /login indi «Giriş seçimi»dir (LoginChooser); portal girişləri PortalLogin-dədir.
 */
export default function AuthPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const nextParam = searchParams.get('next')
  const isRegister = location.pathname === '/register' || searchParams.get('tab') === 'signup'
  const isAdmin =
    searchParams.get('admin') === 'true' || /^\/admin(\/|\?|$)/.test(String(nextParam || '').trim())
  const { theme } = useUiStore()
  const isDark = theme === 'dark'
  const tone = isDark ? 'dark' : 'light'

  useEffect(() => {
    const next = String(nextParam || '').trim()
    if (next.startsWith('/') && next !== '/login' && next !== '/register') {
      rememberReturnAfterLogin(next)
    }
  }, [nextParam])

  useEffect(() => {
    setPageSeo({
      title: isRegister ? 'Mentorix — qeydiyyat' : 'Mentorix — giriş',
      description: 'İmtahanlarınızı, materiallarınızı və nəticələrinizi bir yerdən idarə edin.',
      canonicalPath: isRegister ? '/register' : '/login',
      breadcrumbs: [
        { name: 'Mentorix', path: '/' },
        { name: isRegister ? 'Qeydiyyat' : 'Giriş', path: isRegister ? '/register' : '/login' },
      ],
    })
  }, [isRegister])

  const muted = isDark ? 'text-gray-400' : 'text-slate-500'
  const linkCls = isDark
    ? 'text-primary underline underline-offset-2 hover:no-underline'
    : 'text-emerald-700 underline underline-offset-2 hover:no-underline font-medium'

  return (
    <AuthShell>
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <Brand size="login" tone={tone} />
        </div>
        <div className="h-0.5 w-10 mx-auto rounded-full bg-primary" aria-hidden />
        <h1 className={['text-lg font-bold', isDark ? 'text-white' : 'text-slate-900'].join(' ')}>
          {t('auth.googleOnly.title', { defaultValue: 'Mentorix-ə xoş gəlmisiniz' })}
        </h1>
        <p className={['text-sm leading-relaxed', muted].join(' ')}>
          {t('auth.googleOnly.subtitle', {
            defaultValue: 'İmtahanlarınızı, materiallarınızı və nəticələrinizi bir yerdən idarə edin.',
          })}
        </p>
      </div>

      {isAdmin ? (
        <PasswordLoginForm
          mode="admin"
          idPrefix="admin"
          notice={t('auth.adminPasswordNotice')}
          onSuccess={(data) => {
            useAuthStore.getState().setSession(data.token, data.user)
            postAuthNavigate(data.user, navigate, nextParam)
          }}
        />
      ) : null}

      <PublicGoogleSignIn
        className="mt-6"
        label={t('auth.googleOnly.cta', { defaultValue: 'Google ilə davam et' })}
        context={isRegister ? 'signup' : 'signin'}
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
      {isRegister ? (
        <p className={['mt-3 text-center text-xs', muted].join(' ')}>
          {t('auth.portals.haveAccount', { defaultValue: 'Hesabınız var?' })}{' '}
          <Link to="/login" className={linkCls}>
            {t('auth.portals.chooserTitle', { defaultValue: 'Giriş seçimi' })}
          </Link>
        </p>
      ) : null}
    </AuthShell>
  )
}
