import { useEffect } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Brand from '../../components/common/Brand'
import LocaleThemeBar from '../../components/LocaleThemeBar'
import PublicGoogleSignIn from '../../components/auth/PublicGoogleSignIn'
import { setPageSeo } from '../../lib/pageSeo'
import { rememberReturnAfterLogin } from '../../lib/postAuth'
import useUiStore from '../../hooks/useUi'
import { STICKY_TOP_BAR } from '../../lib/stickyTopBar'

/**
 * Giriş və qeydiyyat (/login, /register): yalnız «Google ilə davam et».
 * Telefon, SMS kod, parol və email/parol formu yoxdur.
 */
export default function AuthPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const nextParam = searchParams.get('next')
  const isRegister = location.pathname === '/register' || searchParams.get('tab') === 'signup'
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
  const linkCls = isDark ? 'text-primary hover:underline' : 'text-emerald-700 hover:underline font-medium'

  return (
    <div
      className={[
        'login-wrapper flex min-h-[100svh] w-full min-w-0 max-w-full flex-col',
        isDark ? 'theme-dark' : 'theme-light',
      ].join(' ')}
    >
      <header
        className={[
          STICKY_TOP_BAR,
          'shrink-0 w-full px-4 py-3 sm:pt-6 sm:pb-4',
          isDark ? 'border-white/10' : 'border-slate-200/80',
        ].join(' ')}
      >
        <div className="flex w-full items-center justify-between gap-2 sm:gap-3">
          <Link
            to="/"
            className={[
              'inline-flex items-center gap-1 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap min-w-0',
              isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900',
            ].join(' ')}
          >
            {t('auth.backHome')}
          </Link>
          <LocaleThemeBar tone={tone} />
        </div>
      </header>
      <main className="flex flex-1 items-start sm:items-center justify-center px-4 pb-8 sm:pb-10 min-h-0 overflow-y-auto">
        <div id="mx-login" className="w-full max-w-sm scroll-mt-6">
          <div
            className={[
              'mx-login-card rounded-2xl border p-6 sm:p-7',
              isDark ? 'border-white/20 bg-surface-2' : 'border-slate-200 bg-white shadow-sm',
            ].join(' ')}
          >
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
          </div>
        </div>
      </main>
    </div>
  )
}
