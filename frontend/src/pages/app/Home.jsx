import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Brand from '../../components/common/Brand'
import PersonaSettingsCard from '../../components/onboarding/PersonaSettingsCard'
import useAuthStore from '../../hooks/useAuth'

export default function GenericAppHome() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const firstName = user?.full_name?.split(' ')[0] || ''

  return (
    <div className="min-h-screen bg-[#07090c] text-white">
      <header className="px-4 sm:px-6 py-4 border-b border-white/10">
        <div className="mx-auto w-full max-w-3xl flex items-center justify-between gap-3">
          <Brand size="md" tone="dark" />
          <Link
            to="/"
            className="text-xs sm:text-sm font-medium text-gray-400 hover:text-white transition-colors whitespace-nowrap"
          >
            {t('auth.backHome')}
          </Link>
        </div>
      </header>
      <main className="px-4 sm:px-6 py-8 sm:py-12">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <div>
            <h1 className="font-display font-bold text-2xl sm:text-[1.75rem] leading-tight">
              {firstName ? t('appHome.greeting', { name: firstName }) : t('appHome.title')}
            </h1>
            <p className="mt-2 text-sm text-gray-400 leading-relaxed">{t('appHome.subtitle')}</p>
          </div>
          <PersonaSettingsCard />
        </div>
      </main>
    </div>
  )
}
