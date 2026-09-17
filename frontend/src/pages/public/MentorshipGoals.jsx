import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PublicMarketingNav from '../../components/public/PublicMarketingNav'
import PublicSeoFooter from '../../components/public/PublicSeoFooter'

const GOALS = ['career', 'technology', 'university', 'language']
const LEVELS = ['beginner', 'developing', 'experienced']
const AVAILABILITY = ['weekdayMorning', 'weekdayEvening', 'weekend']

export default function MentorshipGoals() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [goal, setGoal] = useState(() => {
    const initial = searchParams.get('goal')
    return GOALS.includes(initial) ? initial : ''
  })
  const [level, setLevel] = useState(() => LEVELS.includes(searchParams.get('level')) ? searchParams.get('level') : '')
  const [availability, setAvailability] = useState(() => AVAILABILITY.includes(searchParams.get('availability')) ? searchParams.get('availability') : '')
  const [budget, setBudget] = useState(() => ['starter', 'standard', 'premium'].includes(searchParams.get('budget')) ? searchParams.get('budget') : '')

  const ready = Boolean(goal && level && availability && budget)
  const summary = useMemo(() => {
    if (!ready) return null
    return t('mentorship.goalsPage.summary', {
      goal: t(`mentorship.goals.${goal}.title`),
      level: t(`mentorship.goalsPage.levels.${level}`),
      availability: t(`mentorship.goalsPage.availability.${availability}`),
      budget: t(`mentorship.goalsPage.budgets.${budget}`),
    })
  }, [availability, budget, goal, level, ready, t])

  const selectValue = (key, value, setter) => {
    setter(value)
    const next = new URLSearchParams(searchParams)
    next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  const selectedCount = [goal, level, availability, budget].filter(Boolean).length
  const goalPath = `/mentorship/goals?${searchParams.toString()}`

  return (
    <div className="min-h-[100svh] bg-[#f4f6fb] text-slate-800 flex flex-col">
      <PublicMarketingNav />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-12">
        <Link to="/mentorship" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
          ← {t('mentorship.goalsPage.back')}
        </Link>
        <div className="mt-8 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">{t('mentorship.goalsPage.eyebrow')}</p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">{t('mentorship.goalsPage.title')}</h1>
          <p className="text-base sm:text-lg leading-relaxed text-slate-600">{t('mentorship.goalsPage.description')}</p>
          <div className="mt-5 flex items-center gap-3" aria-label={`4 addımdan ${selectedCount} tamamlandı`}>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(selectedCount / 4) * 100}%` }} />
            </div>
            <span className="text-xs font-bold text-slate-600">{selectedCount}/4 tamamlandı</span>
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.25fr_0.75fr] items-start">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 space-y-8">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t('mentorship.goalsPage.goalLabel')}</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {GOALS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => selectValue('goal', item, setGoal)}
                    className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                      goal === item
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/50'
                    }`}
                  >
                    {t(`mentorship.goals.${item}.title`)}
                  </button>
                ))}
              </div>
            </div>

            <ChoiceGroup label={t('mentorship.goalsPage.levelLabel')} value={level} onChange={(value) => selectValue('level', value, setLevel)} options={LEVELS.map((item) => [item, t(`mentorship.goalsPage.levels.${item}`)])} />
            <ChoiceGroup label={t('mentorship.goalsPage.availabilityLabel')} value={availability} onChange={(value) => selectValue('availability', value, setAvailability)} options={AVAILABILITY.map((item) => [item, t(`mentorship.goalsPage.availability.${item}`)])} />
            <ChoiceGroup label={t('mentorship.goalsPage.budgetLabel')} value={budget} onChange={(value) => selectValue('budget', value, setBudget)} options={['starter', 'standard', 'premium'].map((item) => [item, t(`mentorship.goalsPage.budgets.${item}`)])} />
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white lg:sticky lg:top-24">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-300">{t('mentorship.goalsPage.previewEyebrow')}</p>
            <h2 className="mt-3 text-xl font-bold">{t('mentorship.goalsPage.previewTitle')}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{summary || t('mentorship.goalsPage.previewEmpty')}</p>

            <div className="mt-5 space-y-2 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{t('mentorship.goalsPage.goalLabel')}:</span>
                <span className={goal ? 'font-semibold text-emerald-300' : 'text-slate-500'}>
                  {goal ? t(`mentorship.goals.${goal}.title`) : 'Seçilməyib'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{t('mentorship.goalsPage.levelLabel')}:</span>
                <span className={level ? 'font-semibold text-emerald-300' : 'text-slate-500'}>
                  {level ? t(`mentorship.goalsPage.levels.${level}`) : 'Seçilməyib'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{t('mentorship.goalsPage.availabilityLabel')}:</span>
                  <span className={availability ? 'font-semibold text-emerald-300' : 'text-slate-500 font-medium'}>
                  {availability ? t(`mentorship.goalsPage.availability.${availability}`) : 'Seçilməyib'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{t('mentorship.goalsPage.budgetLabel')}:</span>
                <span className={budget ? 'font-semibold text-emerald-300' : 'text-slate-500'}>
                  {budget ? t(`mentorship.goalsPage.budgets.${budget}`) : 'Seçilməyib'}
                </span>
              </div>
            </div>

            <div className="mt-6 border-t border-white/10 pt-5">
              <Link
                to={ready ? `/login?next=${encodeURIComponent(goalPath)}` : '#'}
                onClick={(e) => {
                  if (!ready) {
                    e.preventDefault()
                  }
                }}
                aria-disabled={!ready}
                className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                  ready
                    ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300 shadow-md shadow-emerald-500/20 cursor-pointer'
                    : 'bg-white/10 text-white/40 cursor-not-allowed'
                }`}
              >
                {t('mentorship.goalsPage.continue')}
              </Link>
              {!ready ? (
                <p className="mt-2 text-center text-xs text-slate-400">
                  Davam etmək üçün bütün 4 addımı seçin
                </p>
              ) : null}
              <p className="mt-3 text-xs leading-relaxed text-slate-400">{t('mentorship.goalsPage.privacyNote')}</p>
            </div>
          </aside>
        </div>
      </main>
      <PublicSeoFooter />
    </div>
  )
}

function ChoiceGroup({ label, value, onChange, options }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900">{label}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map(([key, text]) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              value === key
                ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/50'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}
