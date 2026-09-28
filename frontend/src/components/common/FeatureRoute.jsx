import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../../hooks/useAuth'
import { useFeatureFlags } from '../../lib/featureFlags'
import { dashboardPathForUser } from '../../lib/postAuth'
import Button from './Button'

export function FeatureDisabledPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const home = user ? dashboardPathForUser(user) : '/'
  return (
    <div className="min-h-[60vh] grid place-items-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-token-borderSubtle bg-token-surfaceCard p-6 sm:p-8 text-center">
        <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain">
          {t('featureFlags.disabledTitle', { defaultValue: 'Bu funksiya hazırda aktiv deyil' })}
        </h1>
        <p className="mt-3 text-sm text-token-textMuted">
          {t('featureFlags.disabledText', {
            defaultValue: 'Mentorix imtahan və hazırlıq idarəetməsinə fokuslanır. Bu bölmə müvəqqəti olaraq bağlıdır, məlumatlarınız qorunur.',
          })}
        </p>
        <Link to={home} className="inline-block mt-6">
          <Button type="button">
            {user
              ? t('featureFlags.backToDashboard', { defaultValue: 'Panelə qayıt' })
              : t('featureFlags.backToHome', { defaultValue: 'Ana səhifəyə qayıt' })}
          </Button>
        </Link>
      </div>
    </div>
  )
}

/** Flag OFF olanda səhifəni «aktiv deyil» ekranı ilə əvəz edir. Adminlər həmişə görür. */
export default function FeatureRoute({ flag, children }) {
  const { flags, loaded } = useFeatureFlags()
  const { user } = useAuthStore()
  if (flags[flag] === true || String(user?.role || '').toLowerCase() === 'admin') return children
  if (!loaded) {
    return (
      <div className="min-h-[40vh] grid place-items-center p-6 text-sm text-gray-400" role="status">
        Yüklənir…
      </div>
    )
  }
  return <FeatureDisabledPage />
}
