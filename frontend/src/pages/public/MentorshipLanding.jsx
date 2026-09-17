import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PublicMarketingNav from '../../components/public/PublicMarketingNav'
import PublicSeoFooter from '../../components/public/PublicSeoFooter'
import { setPageSeo } from '../../lib/pageSeo'
import useAuthStore from '../../hooks/useAuth'

const GOALS = [
  { key: 'career', icon: '↗' },
  { key: 'technology', icon: '</>' },
  { key: 'university', icon: '◎' },
  { key: 'language', icon: '文' },
]

const STEPS = ['goal', 'match', 'grow']

export default function MentorshipLanding() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()

  const isMentorUser = String(user?.persona || '').toLowerCase() === 'mentor'
  const initialTab = searchParams.get('tab') || (isMentorUser ? 'mentees' : 'mentors')
  const [activeTab, setActiveTab] = useState(initialTab)

  useEffect(() => {
    const urlTab = searchParams.get('tab')
    if (urlTab && (urlTab === 'mentors' || urlTab === 'mentees')) {
      setActiveTab(urlTab)
    }
  }, [searchParams])

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

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
        <section className="max-w-5xl mx-auto px-4 pt-6 pb-16 sm:pt-10 sm:pb-24">
          <div className="mb-6 sm:mb-8">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
            >
              {t('auth.backHome', { defaultValue: '← Ana səhifə' })}
            </Link>
          </div>
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

            {/* TAB SELECTOR: [🧭 Mentorlar] | [🎓 Mentee-lər / Açıq Sorğular] */}
            <div className="pt-6">
              <div className="inline-flex p-1.5 rounded-2xl bg-slate-200/80 border border-slate-300">
                <button
                  type="button"
                  onClick={() => handleTabChange('mentors')}
                  className={[
                    'flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all',
                    activeTab === 'mentors'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900',
                  ].join(' ')}
                >
                  <span>🧭</span>
                  <span>Mentor Tap</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('mentees')}
                  className={[
                    'flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all',
                    activeTab === 'mentees'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900',
                  ].join(' ')}
                >
                  <span>🎓</span>
                  <span>Mentee / Açıq Sorğular</span>
                </button>
              </div>
            </div>
          </div>

          {activeTab === 'mentors' ? (
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {GOALS.map((goal) => (
                <Link
                  key={goal.key}
                  to={`/mentorship/goals?goal=${goal.key}`}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors shadow-sm"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700 group-hover:bg-emerald-100 group-hover:text-emerald-700">
                    {goal.icon}
                  </span>
                  <h2 className="mt-5 text-lg font-bold text-slate-900">{t(`mentorship.goals.${goal.key}.title`)}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{t(`mentorship.goals.${goal.key}.text`)}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-10 space-y-4">
              <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-emerald-950">
                <p>
                  <strong>Mentorlar üçün açıq vitrin:</strong> Aşağıda karyera yol xəritəsi və mentorluq axtaran real mentee sorğuları yer alır.
                </p>
                <Link
                  to="/instructor"
                  className="inline-flex shrink-0 items-center justify-center px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                >
                  Mentor Kabinetinə Keç →
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    name: 'Aysel Məmmədova',
                    tag: 'Karyera Keçidi',
                    field: 'Python & AI',
                    goal: 'Junior Developer roluna hazırlıq və mock interview dəstəyi axtarır.',
                    status: 'Açıq müraciət',
                  },
                  {
                    name: 'Murad Əliyev',
                    tag: 'Data Analytics',
                    field: 'SQL & PowerBI',
                    goal: 'Portfeli tamamlamaq və real layihə üzərində mentor rəyi almaq istəyir.',
                    status: 'Açıq müraciət',
                  },
                  {
                    name: 'Leyla Həsənli',
                    tag: 'Xaricdə Təhsil',
                    field: 'Almaniya Magistratura',
                    goal: 'Motivation letter və təqaüd müraciəti üçün akademik mentor axtarır.',
                    status: 'Açıq müraciət',
                  },
                ].map((m, idx) => (
                  <div key={idx} className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                          {m.tag}
                        </span>
                        <span className="text-[11px] text-emerald-700 font-semibold">{m.status}</span>
                      </div>
                      <div className="text-base font-bold text-slate-900">{m.name}</div>
                      <div className="text-xs font-semibold text-slate-500">{m.field}</div>
                      <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        "{m.goal}"
                      </p>
                    </div>
                    <Link
                      to="/instructor"
                      className="w-full inline-flex items-center justify-center py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-colors"
                    >
                      Müraciəti qəbul et
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
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
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
            <div className="rounded-3xl bg-emerald-500 p-7 sm:p-10 text-slate-950">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-950/70">Şirkətlər üçün</p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold">Komandanız üçün ölçülə bilən inkişaf proqramı</h2>
              <p className="mt-4 max-w-xl leading-relaxed text-emerald-950/80">
                İşçiləri doğru mentorlarla uyğunlaşdırın, məqsədləri və görüşləri bir məkanda izləyin, inkişafı real nəticələrlə ölçün.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {['Komanda uyğunluğu', 'Vahid dashboard', 'Nəticə hesabatı'].map((item) => (
                  <div key={item} className="rounded-2xl bg-white/30 p-3 text-sm font-bold">{item}</div>
                ))}
              </div>
              <Link to="/partner" className="mt-8 inline-flex items-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800">
                Biznes həllini müzakirə et →
              </Link>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-7 sm:p-10">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Niyə Mentorix?</p>
              <h3 className="mt-3 text-2xl font-bold text-slate-900">Mentorluq yalnız video görüş deyil</h3>
              <ul className="mt-6 space-y-4 text-sm leading-relaxed text-slate-600">
                <li className="flex gap-3"><span className="font-bold text-emerald-600">01</span><span>Hər məqsəd üçün aydın başlanğıc diaqnostikası və yol xəritəsi.</span></li>
                <li className="flex gap-3"><span className="font-bold text-emerald-600">02</span><span>Sessiyalar arasında tapşırıq, geribildirim və növbəti addım.</span></li>
                <li className="flex gap-3"><span className="font-bold text-emerald-600">03</span><span>Yoxlanmış profil, şəffaf qiymət və nəticəyə əsaslanan seçim.</span></li>
              </ul>
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
