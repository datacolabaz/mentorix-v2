import { useState } from 'react'
import { Link } from 'react-router-dom'
import PublicPricingCompare from './PublicPricingCompare'
import PricingFaq from './PricingFaq'
import { CheckIcon, CompassIcon, TeacherIcon } from '../landing/icons'

const FREE_MENTOR_ITEMS = [
  'Mentor profili, bio və ekspertiza sahələrini təyin etmək',
  'Fərdi sessiya və ya paket xidməti təklifləri yaratmaq',
  'Təqvim və müsait saatları idarə etmək',
  'Mentee müraciətlərini qəbul və ya rədd etmək',
  'Əsas mentorluq idarəetməsi və sessiya qeydləri',
]

const UPCOMING_MENTOR_ITEMS = [
  'Axtarışda və vitrində prioritet görünmə',
  'Təkmil mentorluq analitikası və konversiya hesabatları',
  'Avtomatlaşdırılmış xatırlatmalar və görüş təyini',
  'Fərdi brendinq və portfel vitrini',
]

function MentorPricingSection() {
  return (
    <div className="space-y-6">
      <div className="max-w-2xl space-y-2">
        <span className="inline-flex rounded-full bg-brand-subtle px-2.5 py-0.5 text-caption font-semibold uppercase tracking-wide text-brand-text">
          Mentorluq Platforması
        </span>
        <h2 className="text-h2 text-fg">Mentorlar üçün Şəffaf və Çevik Model</h2>
        <p className="text-body leading-relaxed text-fg-secondary">
          Mentorix-də mentor kimi qeydiyyatdan keçmək və profil yaratmaq tamamilə pulsuzdur. Siz öz xidmət və qiymət
          paketlərinizi sərbəst müəyyən edirsiniz.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 pt-2 md:grid-cols-2">
        <div className="flex flex-col justify-between space-y-6 rounded-3xl border border-brand-text/40 bg-surface p-6 shadow-card sm:p-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="rounded-md border border-line bg-brand-subtle px-2.5 py-1 text-caption font-semibold uppercase tracking-wide text-brand-text">
                Əsas Giriş
              </span>
              <span className="text-2xl font-bold text-fg">0 ₼</span>
            </div>
            <div>
              <h3 className="text-h3 text-fg">Pulsuz Başlanğıc</h3>
              <p className="mt-1 text-body-sm leading-relaxed text-fg-secondary">
                Platformada mentor kimi profil yaradın və tələbələrdən ilk 1-on-1 müraciətlərinizi qəbul edin.
              </p>
            </div>
            <ul className="space-y-2.5 border-t border-line pt-3 text-body-sm text-fg-secondary">
              {FREE_MENTOR_ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-text" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <Link
            to="/login"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-brand px-4 py-3 text-center text-button text-brand-on hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Mentor Kimi Pulsuz Başla
          </Link>
        </div>

        <div className="flex flex-col justify-between space-y-6 rounded-3xl border border-line bg-canvas-subtle p-6 shadow-card sm:p-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="rounded-md bg-info-subtle px-2.5 py-1 text-caption font-semibold uppercase tracking-wide text-info">
                Təkmil Alətlər
              </span>
              <span className="rounded-md border border-line bg-surface px-2 py-1 text-caption font-semibold text-fg-secondary">
                Tezliklə
              </span>
            </div>
            <div>
              <h3 className="text-h3 text-fg">Premium Mentor İmkanları</h3>
              <p className="mt-1 text-body-sm leading-relaxed text-fg-secondary">
                Mentorluq fəaliyyətini genişləndirmək və daha çox mentee cəlb etmək üçün qabaqcıl imkanlar.
              </p>
            </div>
            <ul className="space-y-2.5 border-t border-line pt-3 text-body-sm text-fg-secondary">
              {UPCOMING_MENTOR_ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full border border-line-strong" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="rounded-xl border border-line bg-surface p-3 text-center text-body-sm leading-relaxed text-fg-muted">
            Gələcək komissiya və ya abunəlik modeli mentorluq icması ilə birgə formalaşdırılacaqdır.
          </p>
        </div>
      </div>
    </div>
  )
}

const TABS = [
  { id: 'teacher', label: 'Müəllimlər və Təşkilatlar üçün', Icon: TeacherIcon },
  { id: 'mentor', label: 'Mentorlar üçün', Icon: CompassIcon },
]

export default function PublicPricingAudienceGroups({ plans, onCta }) {
  const [activeAudience, setActiveAudience] = useState('teacher')

  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="Qiymət auditoriyası"
          className="inline-flex max-w-full flex-wrap justify-center gap-1 rounded-2xl border border-line bg-canvas-subtle p-1.5"
        >
          {TABS.map(({ id, label, Icon }) => {
            const active = activeAudience === id
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`pricing-tab-${id}`}
                aria-selected={active}
                aria-controls="pricing-audience-panel"
                onClick={() => setActiveAudience(id)}
                className={[
                  'inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2.5 text-body-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:px-5',
                  active ? 'bg-surface text-fg shadow-card' : 'text-fg-secondary hover:text-fg',
                ].join(' ')}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div id="pricing-audience-panel" role="tabpanel" aria-labelledby={`pricing-tab-${activeAudience}`}>
        {activeAudience === 'teacher' ? (
          <div className="space-y-10">
            <PublicPricingCompare plans={plans} onCta={onCta} hideIntro />
            <PricingFaq />
          </div>
        ) : (
          <MentorPricingSection />
        )}
      </div>
    </div>
  )
}
