import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../common/Button'
import {
  BUDGET_OPTIONS,
  DURATION_OPTIONS,
  wizardToSearchParams,
} from '../../lib/universitySearch'
import { fieldOptionLabel } from '../../lib/universityFieldI18n'
import { countryDisplayName } from '../../lib/universityCountryI18n'
import useActiveLocale from '../../hooks/useActiveLocale'
import useUiStore from '../../hooks/useUi'
import CountrySearchPicker from './CountrySearchPicker'
import FieldOptionList from './FieldOptionList'

const STEP_KEYS = ['degree', 'field', 'academic', 'preferences', 'review']
const DEGREE_OPTIONS = ['BSc', 'MSc', 'PhD']

const inputCls = (light) =>
  light
    ? 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 [color-scheme:light] focus:outline-none focus:border-primary/50'
    : 'w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white [color-scheme:dark] focus:outline-none focus:border-primary/50'

function StepDots({ step, stepTitles, light }) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {stepTitles.map((title, index) => {
        const id = index + 1
        return (
          <div
            key={id}
            className={[
              'h-2 rounded-full transition-all',
              id === step ? 'w-8 bg-primary' : id < step ? 'w-2 bg-primary/60' : light ? 'w-2 bg-slate-200' : 'w-2 bg-white/15',
            ].join(' ')}
            title={title}
          />
        )
      })}
    </div>
  )
}

export default function UniversitySearchWizard({ initialState, onSubmit, onCancel }) {
  const { t } = useTranslation()
  const locale = useActiveLocale()
  const theme = useUiStore((s) => s.theme)
  const light = theme !== 'dark'
  const [step, setStep] = useState(1)
  const [state, setState] = useState(initialState)

  const stepTitles = STEP_KEYS.map((key) => t(`universitySearch.wizard.steps.${key}`))

  const degreeLabel = (deg) => {
    if (deg === 'BSc') return t('universitySearch.degrees.bsc')
    if (deg === 'MSc') return t('universitySearch.degrees.msc')
    return t('universitySearch.degrees.phd')
  }

  const budgetLabel = (value) => t(`universitySearch.budget.${value}`, { defaultValue: '—' })

  const durationLabel = (years) => {
    if (!years) return t('universitySearch.wizard.durationAny')
    const key = years >= 4 ? '4' : String(years)
    return t(`universitySearch.duration.${key}`, { defaultValue: t('universitySearch.wizard.durationYears', { count: years }) })
  }

  const reviewSummary = useMemo(
    () => [
      { label: t('universitySearch.wizard.review.degree'), value: state.degreeLevel || '—' },
      { label: t('universitySearch.wizard.review.field'), value: state.field ? fieldOptionLabel(state.field, locale) : '—' },
      { label: t('universitySearch.wizard.review.gpa'), value: state.gpa !== '' ? state.gpa : '—' },
      {
        label: t('universitySearch.wizard.review.languageScore'),
        value:
          state.languageScore !== ''
            ? `${state.languageType.toUpperCase()} ${state.languageScore}`
            : '—',
      },
      {
        label: t('universitySearch.wizard.review.countries'),
        value: state.countries.length
          ? state.countries.map((c) => countryDisplayName(c, locale)).join(', ')
          : t('universitySearch.wizard.review.allCountries'),
      },
      {
        label: t('universitySearch.wizard.review.budget'),
        value: state.budgetRange ? budgetLabel(state.budgetRange) : '—',
      },
      {
        label: t('universitySearch.wizard.review.duration'),
        value: state.durationYears ? durationLabel(state.durationYears) : t('universitySearch.wizard.durationAny'),
      },
    ],
    [state, t, locale],
  )

  const canNext = () => {
    if (step === 1) return Boolean(state.degreeLevel)
    if (step === 2) return Boolean(state.field)
    if (step === 3) return state.gpa !== '' && state.languageScore !== ''
    if (step === 4) return true
    return true
  }

  const next = () => setStep((s) => Math.min(5, s + 1))
  const back = () => setStep((s) => Math.max(1, s - 1))

  return (
    <div className={["rounded-2xl border p-5 sm:p-8 space-y-6", light ? 'border-slate-200 bg-white shadow-sm' : 'border-white/10 bg-white/[0.03]'].join(' ')}>
      <div className="text-center space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          {t('universitySearch.wizard.stepOf', { step, total: STEP_KEYS.length })}
        </p>
        <h2 className={['font-display text-xl sm:text-2xl font-bold', light ? 'text-slate-900' : 'text-white'].join(' ')}>{stepTitles[step - 1]}</h2>
        <StepDots step={step} stepTitles={stepTitles} light={light} />
      </div>

      {step === 1 ? (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-md mx-auto w-full min-w-0">
          {DEGREE_OPTIONS.map((deg) => (
            <button
              key={deg}
              type="button"
              onClick={() => setState((p) => ({ ...p, degreeLevel: deg }))}
              className={[
                'min-w-0 overflow-hidden rounded-2xl border px-1.5 sm:px-4 py-5 sm:py-6 text-center transition-all',
                state.degreeLevel === deg
                  ? light
                    ? 'border-primary bg-primary/10 text-slate-900 shadow-[0_0_0_1px_rgba(34,224,136,0.35)]'
                    : 'border-primary bg-primary/15 text-white shadow-[0_0_0_1px_rgba(34,224,136,0.35)]'
                  : light
                    ? 'border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300'
                    : 'border-white/10 bg-[#1c1c1c] text-gray-300 hover:border-white/25',
              ].join(' ')}
            >
              <div className="text-xl sm:text-2xl font-bold">{deg}</div>
              <div className={['mt-1 px-0.5 text-[9px] sm:text-[10px] font-semibold uppercase leading-tight tracking-normal [overflow-wrap:anywhere]', light ? 'text-slate-500' : 'text-gray-500'].join(' ')}>
                {degreeLabel(deg)}
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="max-w-lg mx-auto space-y-3" key={`wizard-field-step-${locale}`}>
          <label className={['block text-xs font-semibold uppercase tracking-wide', light ? 'text-slate-500' : 'text-gray-400'].join(' ')}>
            {t('universitySearch.wizard.fieldLabel')}
          </label>
          {state.field ? (
            <div className={['flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm', light ? 'text-slate-900' : 'text-white'].join(' ')}>
              <span>{fieldOptionLabel(state.field, locale)}</span>
              <button
                type="button"
                className={['text-xs shrink-0', light ? 'text-slate-500 hover:text-slate-900' : 'text-gray-400 hover:text-white'].join(' ')}
                onClick={() => setState((p) => ({ ...p, field: '' }))}
              >
                ×
              </button>
            </div>
          ) : (
            <p className={['text-xs', light ? 'text-slate-500' : 'text-gray-500'].join(' ')}>{t('universitySearch.wizard.selectPlaceholder')}</p>
          )}
          <div className={['rounded-xl border p-2', light ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-[#1c1c1c]'].join(' ')}>
            <FieldOptionList
              locale={locale}
              value={state.field}
              mode="single"
              onChange={(slug) => setState((p) => ({ ...p, field: slug }))}
            />
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="max-w-lg mx-auto space-y-5">
          <div className="space-y-2">
            <div className={['flex justify-between text-xs', light ? 'text-slate-500' : 'text-gray-400'].join(' ')}>
              <span>{t('universitySearch.wizard.gpaScale')}</span>
              <span className={['font-medium', light ? 'text-slate-900' : 'text-white'].join(' ')}>{state.gpa !== '' ? state.gpa : '—'}</span>
            </div>
            <input
              type="range"
              min="2"
              max="4"
              step="0.1"
              value={state.gpa !== '' ? state.gpa : 3}
              onChange={(e) => setState((p) => ({ ...p, gpa: Number(e.target.value) }))}
              className="w-full accent-primary"
            />
            <input
              type="number"
              min="0"
              max="4"
              step="0.1"
              value={state.gpa}
              onChange={(e) => setState((p) => ({ ...p, gpa: e.target.value === '' ? '' : Number(e.target.value) }))}
              className={inputCls(light)}
              placeholder={t('universitySearch.wizard.gpaPlaceholder')}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={['text-xs font-semibold uppercase tracking-wide', light ? 'text-slate-500' : 'text-gray-400'].join(' ')}>
                {t('universitySearch.wizard.languageExam')}
              </label>
              <select
                value={state.languageType}
                onChange={(e) => setState((p) => ({ ...p, languageType: e.target.value }))}
                className={inputCls(light)}
              >
                <option value="ielts">IELTS</option>
                <option value="toefl">TOEFL</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={['text-xs font-semibold uppercase tracking-wide', light ? 'text-slate-500' : 'text-gray-400'].join(' ')}>
                {t('universitySearch.wizard.score')}
              </label>
              <input
                type="number"
                min="0"
                max={state.languageType === 'ielts' ? 9 : 120}
                step={state.languageType === 'ielts' ? 0.5 : 1}
                value={state.languageScore}
                onChange={(e) =>
                  setState((p) => ({
                    ...p,
                    languageScore: e.target.value === '' ? '' : Number(e.target.value),
                  }))
                }
                className={inputCls(light)}
                placeholder={state.languageType === 'ielts' ? '6.5' : '90'}
              />
            </div>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="max-w-2xl mx-auto space-y-5">
          <CountrySearchPicker
            selected={state.countries}
            onChange={(countries) => setState((p) => ({ ...p, countries }))}
            label={t('universitySearch.wizard.countryPicker')}
          />

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={['text-xs font-semibold uppercase tracking-wide', light ? 'text-slate-500' : 'text-gray-400'].join(' ')}>
                {t('universitySearch.wizard.budget')}
              </label>
              <select
                value={state.budgetRange}
                onChange={(e) => setState((p) => ({ ...p, budgetRange: e.target.value }))}
                className={inputCls(light)}
              >
                {BUDGET_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {budgetLabel(b.value)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={['text-xs font-semibold uppercase tracking-wide', light ? 'text-slate-500' : 'text-gray-400'].join(' ')}>
                {t('universitySearch.wizard.durationPreference')}
              </label>
              <select
                value={state.durationYears}
                onChange={(e) =>
                  setState((p) => ({
                    ...p,
                    durationYears: e.target.value === '' ? '' : Number(e.target.value),
                  }))
                }
                className={inputCls(light)}
              >
                <option value="">{t('universitySearch.wizard.durationAny')}</option>
                {DURATION_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {durationLabel(d.value)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="max-w-lg mx-auto space-y-4">
          <p className={['text-sm text-center', light ? 'text-slate-500' : 'text-gray-400'].join(' ')}>{t('universitySearch.wizard.reviewHint')}</p>
          <dl className={['rounded-xl border divide-y', light ? 'border-slate-200 divide-slate-200' : 'border-white/10 divide-white/10'].join(' ')}>
            {reviewSummary.map((row) => (
              <div key={row.label} className="flex justify-between gap-4 px-4 py-3 text-sm">
                <dt className={light ? 'text-slate-500' : 'text-gray-500'}>{row.label}</dt>
                <dd className={['text-right', light ? 'text-slate-900' : 'text-white'].join(' ')}>{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 justify-between pt-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (step > 1) {
                back()
                return
              }
              onCancel?.()
            }}
            disabled={step === 1 && !onCancel}
          >
            {t('universitySearch.actions.back')}
          </Button>
        </div>
        <div className="flex gap-2">
          {step < 5 ? (
            <Button type="button" onClick={next} disabled={!canNext()}>
              {t('universitySearch.actions.next')}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => onSubmit?.({ state, params: wizardToSearchParams(state) })}
            >
              {t('universitySearch.actions.searchPrograms')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
