import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PublicMarketingNav from '../../components/public/PublicMarketingNav'
import PublicSeoFooter from '../../components/public/PublicSeoFooter'
import useAuthStore from '../../hooks/useAuth'
import { setPageSeo } from '../../lib/pageSeo'
import { useEffect } from 'react'

const DASHBOARD = '/partner/dashboard'
const LOGIN_NEXT = `/login?next=${encodeURIComponent(DASHBOARD)}`
const REGISTER_NEXT = `/register?next=${encodeURIComponent(DASHBOARD)}`

/** İctimai Partner proqramı giriş səhifəsi — kabinetdən ayrı, kəşf oluna bilən. */
export default function PartnerProgramLanding() {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  useEffect(() => {
    setPageSeo({
      title: t('partner.public.seoTitle', { defaultValue: 'Mentorix — Partner proqramı' }),
      description: t('partner.public.seoDesc', {
        defaultValue:
          'Mentorix Partner proqramı: referral link paylaşın, endirimli qeydiyyat və komissiya qazanın.',
      }),
      canonicalPath: '/partner',
      breadcrumbs: [
        { name: 'Mentorix', path: '/' },
        { name: t('partner.public.nav', { defaultValue: 'Partner proqramı' }), path: '/partner' },
      ],
    })
  }, [t])

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white">
      <PublicMarketingNav />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">
          {t('partner.public.eyebrow', { defaultValue: 'Partner proqramı' })}
        </p>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight">
          {t('partner.public.title', { defaultValue: 'Mentorix ilə birlikdə böyüyün' })}
        </h1>
        <p className="mt-4 text-base sm:text-lg text-gray-300 leading-relaxed">
          {t('partner.public.lead', {
            defaultValue:
              'Referral linkinizi paylaşın. Yeni müəllimlər endirimlə qoşulur; siz təsdiqlənmiş ödənişlərdən komissiya qazanırsınız. Bu, təşkilat (organization) kabineti deyil — ayrıca Partner paneli.',
          })}
        </p>

        <ul className="mt-8 space-y-3 text-gray-200">
          <li className="flex gap-3">
            <span className="text-primary font-bold" aria-hidden>
              ·
            </span>
            {t('partner.public.b1', {
              defaultValue: 'Şəxsi referral link və klik/attribution statistika',
            })}
          </li>
          <li className="flex gap-3">
            <span className="text-primary font-bold" aria-hidden>
              ·
            </span>
            {t('partner.public.b2', {
              defaultValue: 'İstifadəçiyə endirim · sizə komissiya (kampaniya şərtlərinə görə)',
            })}
          </li>
          <li className="flex gap-3">
            <span className="text-primary font-bold" aria-hidden>
              ·
            </span>
            {t('partner.public.b3', {
              defaultValue: 'Payout sorğusu Partner kabinetindən',
            })}
          </li>
        </ul>

        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          {user ? (
            <Link
              to={DASHBOARD}
              className="inline-flex justify-center items-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-[#041018] hover:brightness-95"
            >
              {t('partner.public.openCabinet', { defaultValue: 'Partner kabineti' })}
            </Link>
          ) : (
            <>
              <Link
                to={REGISTER_NEXT}
                className="inline-flex justify-center items-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-[#041018] hover:brightness-95"
              >
                {t('partner.public.joinCta', { defaultValue: 'Partner ol — qeydiyyat' })}
              </Link>
              <Link
                to={LOGIN_NEXT}
                className="inline-flex justify-center items-center rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                {t('partner.public.loginCta', { defaultValue: 'Giriş edib müraciət et' })}
              </Link>
            </>
          )}
        </div>

        <p className="mt-6 text-sm text-gray-500">
          {t('partner.public.notOrg', {
            defaultValue:
              'Təşkilat paketi və /org kabineti ayrıdır. Partner proqramı referral komissiyası üçündür.',
          })}
        </p>
      </main>
      <PublicSeoFooter className="rounded-none" />
    </div>
  )
}
