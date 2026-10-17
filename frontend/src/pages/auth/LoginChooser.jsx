import { useEffect } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useUiStore from '../../hooks/useUi'
import Brand from '../../components/common/Brand'
import NavIcon from '../../components/common/NavIcon'
import AuthShell from '../../components/auth/AuthShell'
import { setPageSeo } from '../../lib/pageSeo'
import { LOGIN_PORTALS, LOGIN_PORTAL_ORDER } from '../../lib/loginPortals'

/** /login — «Giriş seçimi»: four portals; ?next= is carried to the chosen one. */
export default function LoginChooser() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const isDark = useUiStore((s) => s.theme) === 'dark'
  const next = String(searchParams.get('next') || '').trim()
  const legacyAdmin = searchParams.get('admin') === 'true' || /^\/admin(\/|\?|$)/.test(next)

  useEffect(() => {
    setPageSeo({
      title: 'Mentorix — giriş',
      description: 'Tələbə, təlimçi, təşkilat və ya admin kimi daxil olun.',
      canonicalPath: '/login',
      breadcrumbs: [
        { name: 'Mentorix', path: '/' },
        { name: 'Giriş', path: '/login' },
      ],
    })
  }, [])

  const suffix = next ? `?next=${encodeURIComponent(next)}` : ''
  // Old admin links (/login?admin=true, next=/admin…) keep working.
  if (legacyAdmin) return <Navigate to={`/login/admin${suffix}`} replace />

  const muted = isDark ? 'text-gray-400' : 'text-slate-500'

  return (
    <AuthShell wide>
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <Brand size="login" tone={isDark ? 'dark' : 'light'} />
        </div>
        <div className="h-0.5 w-10 mx-auto rounded-full bg-primary" aria-hidden />
        <h1 className={['text-lg font-bold', isDark ? 'text-white' : 'text-slate-900'].join(' ')}>
          {t('auth.portals.chooserTitle', { defaultValue: 'Giriş seçimi' })}
        </h1>
        <p className={['text-sm leading-relaxed', muted].join(' ')}>
          {t('auth.portals.chooserSubtitle', {
            defaultValue: 'Hansı kabinetə daxil olmaq istəyirsiniz? Bir hesabla yalnız sizə verilmiş kabinetlər açılır.',
          })}
        </p>
      </div>
      <nav aria-label={t('auth.portals.chooserTitle', { defaultValue: 'Giriş seçimi' })} className="mt-6">
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {LOGIN_PORTAL_ORDER.map((id) => {
            const p = LOGIN_PORTALS[id]
            return (
              <li key={id}>
                <Link
                  to={`${p.path}${suffix}`}
                  data-testid={`portal-choice-${id}`}
                  className={[
                    'flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-colors min-h-[64px]',
                    isDark ? 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]' : 'border-slate-200 bg-white hover:bg-slate-50',
                    p.accent.ring,
                  ].join(' ')}
                >
                  <span
                    className={[
                      'w-10 h-10 shrink-0 rounded-xl flex items-center justify-center',
                      isDark ? p.accent.chipDark : p.accent.chip,
                    ].join(' ')}
                  >
                    <NavIcon name={p.icon} className="w-5 h-5" />
                  </span>
                  <span className="min-w-0 text-left">
                    <span className={['block font-semibold text-sm', isDark ? 'text-white' : 'text-slate-900'].join(' ')}>
                      {t(p.cardKey, { defaultValue: p.card })}
                    </span>
                    <span className={['block text-xs leading-snug', muted].join(' ')}>
                      {t(p.titleKey, { defaultValue: p.title })}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <p className={['mt-5 text-center text-xs', muted].join(' ')}>
        {t('auth.portals.noAccount', { defaultValue: 'Hesabınız yoxdur?' })}{' '}
        <Link
          to="/register"
          className={isDark ? 'text-primary underline underline-offset-2' : 'text-emerald-700 underline underline-offset-2 font-medium'}
        >
          {t('auth.portals.createAccount', { defaultValue: 'Hesab yarat' })}
        </Link>
      </p>
    </AuthShell>
  )
}
