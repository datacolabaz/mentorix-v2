import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PublicMarketingNav from '../../components/public/PublicMarketingNav'
import PublicSeoFooter from '../../components/public/PublicSeoFooter'
import { setPageSeo } from '../../lib/pageSeo'

const GOALS = [
  { key: 'career', icon: '↗' },
  { key: 'technology', icon: '</>' },
  { key: 'university', icon: '◎' },
  { key: 'language', icon: '文' },
]

const STEPS = ['goal', 'match', 'grow']

export default function MentorshipLanding() {
  const { t } = useTranslation()

  useEffect(() => {
    setPageSeo({
      title: t('mentorship.seoTitle'),
      description: t('mentorship.seoDescription'),
      canonicalPath: '/mentorship',
      keywords: t('mentorship.seoKeywords'),
      breadcrumbs: [
        { name: 'Mentorix', path: '/' },
        { name: t('mentorship.navLabel'), path: '/mentorship' },
      ],
    })
  }, [t])

  return (
    <div className="min-h-[100svh] bg-[#f4f6fb] text-slate-800 flex flex-col">
      <PublicMarketingNav />

      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-4 pt-12 pb-16 sm:pt-20 sm:pb-24">
          <div className="max-w-3xl space-y-6">
            <p className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
              {t('mentorship.eyebrow')}
            </p>
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.08] text-slate-900">
              {t('mentorship.title')}
            </h1>
            <p className="text-lg sm:text-xl leading-relaxed text-slate-600 max-w-2xl">
              {t('mentorship.description')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                to="/mentorship/goals"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-3.5 text-base font-bold text-slate-950 hover:bg-emerald-400 transition-colors"
              >
                {t('mentorship.startCta')} →
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-base font-semibold text-slate-800 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
              >
                {t('mentorship.mentorCta')}
              </Link>
            </div>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GOALS.map((goal) => (
              <Link
                key={goal.key}
                to={`/mentorship/goals?goal=${goal.key}`}
                className="group rounded-2xl border border-slate-200 bg-white p-5 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700 group-hover:bg-emerald-100 group-hover:text-emerald-700">
                  {goal.icon}
                </span>
                <h2 className="mt-5 text-lg font-bold text-slate-900">{t(`mentorship.goals.${goal.key}.title`)}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{t(`mentorship.goals.${goal.key}.text`)}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="max-w-5xl mx-auto px-4 py-14 sm:py-20">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">{t('mentorship.howEyebrow')}</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">{t('mentorship.howTitle')}</h2>
              <p className="text-base leading-relaxed text-slate-600">{t('mentorship.howDescription')}</p>
            </div>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <article key={step} className="relative border-t-2 border-emerald-200 pt-5">
                  <span className="text-sm font-bold text-emerald-700">0{index + 1}</span>
                  <h3 className="mt-3 text-xl font-bold text-slate-900">{t(`mentorship.steps.${step}.title`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{t(`mentorship.steps.${step}.text`)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 py-14 sm:py-20">
          <div className="rounded-3xl bg-slate-900 px-6 py-10 sm:px-10 sm:py-14 text-white">
            <div className="max-w-2xl space-y-4">
              <h2 className="text-2xl sm:text-3xl font-bold">{t('mentorship.bottomTitle')}</h2>
              <p className="text-slate-300 leading-relaxed">{t('mentorship.bottomText')}</p>
              <Link
                to="/mentorship/goals"
                className="inline-flex mt-2 items-center rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-300 transition-colors"
              >
                {t('mentorship.startCta')} →
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicSeoFooter />
    </div>
  )
}
