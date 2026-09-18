import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DEFAULT_SUBSCRIPTION_PLANS } from '../../constants/subscriptionPlans'
import { plansForAudience } from '../../lib/landingCopy'
import PublicPricingCompare, { PricingPlanCard } from './PublicPricingCompare'

function AudiencePlanGrid({ title, intro, plans, onCta }) {
  if (!plans.length) return null
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {intro ? <p className="text-base text-slate-600 leading-relaxed">{intro}</p> : null}
      </div>
      <div className={`grid gap-3 ${plans.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {plans.map((plan) => (
          <PricingPlanCard key={plan.id} plan={plan} onCta={onCta} />
        ))}
      </div>
    </section>
  )
}

function MentorPricingSection() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 max-w-2xl">
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
          Mentorluq Platforması
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
          Mentorlar üçün Şəffaf və Çevik Model
        </h2>
        <p className="text-base text-slate-600 leading-relaxed">
          Mentorix-də mentor kimi qeydiyyatdan keçmək və profil yaratmaq tamamilə pulsuzdur. Siz öz xidmət və qiymət paketlərinizi sərbəst müəyyən edirsiniz.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Free Entry Card */}
        <div className="rounded-3xl border border-emerald-300 bg-white p-6 sm:p-8 space-y-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                Əsas Giriş
              </span>
              <span className="text-2xl font-black text-slate-900">0 ₼</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Pulsuz Başlanğıc</h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                Platformada mentor kimi profil yaradın və tələbələrdən ilk 1-on-1 müraciətlərinizi qəbul edin.
              </p>
            </div>
            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700 pt-2 border-t border-slate-100">
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Mentor profili, bio və ekspertiza sahələrini təyin etmək</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Fərdi sessiya və ya paket xidməti təklifləri yaratmaq</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Təqvim və müsait saatları idarə etmək</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Mentee müraciətlərini qəbul və ya rədd etmək</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Əsas mentorluq idarəetməsi və sessiya qeydləri</span>
              </li>
            </ul>
          </div>
          <Link
            to="/login"
            className="w-full inline-flex items-center justify-center py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-primary hover:brightness-95 text-[#041018] shadow-sm transition-all text-center"
          >
            Mentor Kimi Pulsuz Başla →
          </Link>
        </div>

        {/* Premium Tools (Coming Soon) */}
        <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 sm:p-8 space-y-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-100 px-2.5 py-1 rounded-md">
                Təkmil Alətlər
              </span>
              <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded-md border border-purple-200">
                Tezliklə
              </span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Premium Mentor İmkanları</h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                Mentorluq fəaliyyətini genişləndirmək və daha çox mentee cəlb etmək üçün qabaqcıl imkanlar.
              </p>
            </div>
            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600 pt-2 border-t border-slate-200">
              <li className="flex items-start gap-2">
                <span className="text-slate-400 font-bold">○</span>
                <span>Axtarışda və vitrində prioritet görünmə</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 font-bold">○</span>
                <span>Təkmil mentorluq analitikası və konversiya hesabatları</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 font-bold">○</span>
                <span>Avtomatlaşdırılmış xatırlatmalar və görüş təyini</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 font-bold">○</span>
                <span>Fərdi brendinq və portfel vitrini</span>
              </li>
            </ul>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-500 leading-relaxed text-center">
            💡 Gələcək komissiya və ya abunəlik modeli mentorluq icması ilə birgə formalaşdırılacaqdır.
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PublicPricingAudienceGroups({ plans, onCta }) {
  const { t } = useTranslation()
  const [activeAudience, setActiveAudience] = useState('teacher') // 'teacher' | 'mentor'

  const list = Array.isArray(plans) && plans.length ? plans : DEFAULT_SUBSCRIPTION_PLANS
  const teacher = plansForAudience(list, 'teacher')
  const center = plansForAudience(list, 'center')

  return (
    <div className="space-y-8">
      {/* SEGMENTATION TABS: [👨‍🏫 Müəllimlər üçün] | [🚀 Mentorlar üçün] */}
      <div className="flex justify-center">
        <div className="inline-flex p-1.5 rounded-2xl bg-slate-200/80 border border-slate-300">
          <button
            type="button"
            onClick={() => setActiveAudience('teacher')}
            className={[
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all',
              activeAudience === 'teacher'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900',
            ].join(' ')}
          >
            <span>👨‍🏫</span>
            <span>Müəllimlər və Təşkilatlar üçün</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveAudience('mentor')}
            className={[
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all',
              activeAudience === 'mentor'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900',
            ].join(' ')}
          >
            <span>🚀</span>
            <span>Mentorlar üçün</span>
          </button>
        </div>
      </div>

      {activeAudience === 'teacher' ? (
        <div className="space-y-10">
          <AudiencePlanGrid
            title={t('landing.pricingPage.groups.teacher.title')}
            intro={t('landing.pricingPage.groups.teacher.intro')}
            plans={teacher}
            onCta={onCta}
          />
          <AudiencePlanGrid
            title={t('landing.pricingPage.groups.center.title')}
            intro={t('landing.pricingPage.groups.center.intro')}
            plans={center}
            onCta={onCta}
          />
          <PublicPricingCompare plans={plans} hideIntro tableOnly />
        </div>
      ) : (
        <MentorPricingSection />
      )}
    </div>
  )
}
