import { useMemo, useState } from 'react'
import Button from '../common/Button'
import {
  BUDGET_OPTIONS,
  DURATION_OPTIONS,
  wizardToSearchParams,
} from '../../lib/universitySearch'
import { FIELD_GROUPS, fieldLabel } from '../../lib/universityFieldCatalog'
import CountrySearchPicker from './CountrySearchPicker'

const STEPS = [
  { id: 1, title: 'Dərəcə' },
  { id: 2, title: 'İxtisas' },
  { id: 3, title: 'Akademik' },
  { id: 4, title: 'Üstünlüklər' },
  { id: 5, title: 'Yoxlama' },
]

const DEGREE_OPTIONS = ['BSc', 'MSc', 'PhD']

const inputCls =
  'w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white [color-scheme:dark] focus:outline-none focus:border-primary/50'

function StepDots({ step }) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {STEPS.map((s) => (
        <div
          key={s.id}
          className={[
            'h-2 rounded-full transition-all',
            s.id === step ? 'w-8 bg-primary' : s.id < step ? 'w-2 bg-primary/60' : 'w-2 bg-white/15',
          ].join(' ')}
          title={s.title}
        />
      ))}
    </div>
  )
}

export default function UniversitySearchWizard({ initialState, onSubmit, onCancel }) {
  const [step, setStep] = useState(1)
  const [state, setState] = useState(initialState)

  const reviewSummary = useMemo(
    () => [
      { label: 'Dərəcə', value: state.degreeLevel || '—' },
      { label: 'İxtisas', value: state.field ? fieldLabel(state.field) : '—' },
      { label: 'GPA', value: state.gpa !== '' ? state.gpa : '—' },
      {
        label: 'Dil balı',
        value:
          state.languageScore !== ''
            ? `${state.languageType.toUpperCase()} ${state.languageScore}`
            : '—',
      },
      { label: 'Ölkələr', value: state.countries.length ? state.countries.join(', ') : 'Hamısı' },
      {
        label: 'Büdcə',
        value: BUDGET_OPTIONS.find((b) => b.value === state.budgetRange)?.label || '—',
      },
      {
        label: 'Müddət',
        value: state.durationYears ? `${state.durationYears} il` : 'Fərq etmir',
      },
    ],
    [state],
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-8 space-y-6">
      <div className="text-center space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Addım {step} / 5</p>
        <h2 className="font-display text-xl sm:text-2xl font-bold text-white">{STEPS[step - 1].title}</h2>
        <StepDots step={step} />
      </div>

      {step === 1 ? (
        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
          {DEGREE_OPTIONS.map((deg) => (
            <button
              key={deg}
              type="button"
              onClick={() => setState((p) => ({ ...p, degreeLevel: deg }))}
              className={[
                'rounded-2xl border px-4 py-6 text-center transition-all',
                state.degreeLevel === deg
                  ? 'border-primary bg-primary/15 text-white shadow-[0_0_0_1px_rgba(34,224,136,0.35)]'
                  : 'border-white/10 bg-[#1c1c1c] text-gray-300 hover:border-white/25',
              ].join(' ')}
            >
              <div className="text-2xl font-bold">{deg}</div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500 mt-1">
                {deg === 'BSc' ? 'Bakalavr' : deg === 'MSc' ? 'Magistr' : 'Doktorantura'}
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="max-w-lg mx-auto space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">İxtisas sahəsi</label>
          <select
            value={state.field}
            onChange={(e) => setState((p) => ({ ...p, field: e.target.value }))}
            className={inputCls}
          >
            <option value="">— Seçin —</option>
            {FIELD_GROUPS.map((group) => (
              <optgroup key={group.id} label={group.label}>
                {group.options.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="max-w-lg mx-auto space-y-5">
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>GPA (4.0 şkalası)</span>
              <span className="text-white font-medium">{state.gpa !== '' ? state.gpa : '—'}</span>
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
              className={inputCls}
              placeholder="Məs: 3.2"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Dil imtahanı</label>
              <select
                value={state.languageType}
                onChange={(e) => setState((p) => ({ ...p, languageType: e.target.value }))}
                className={inputCls}
              >
                <option value="ielts">IELTS</option>
                <option value="toefl">TOEFL</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Bal</label>
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
                className={inputCls}
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
            label="Ölkə seçimi"
          />

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Büdcə</label>
              <select
                value={state.budgetRange}
                onChange={(e) => setState((p) => ({ ...p, budgetRange: e.target.value }))}
                className={inputCls}
              >
                {BUDGET_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Müddət üstünlüyü</label>
              <select
                value={state.durationYears}
                onChange={(e) =>
                  setState((p) => ({
                    ...p,
                    durationYears: e.target.value === '' ? '' : Number(e.target.value),
                  }))
                }
                className={inputCls}
              >
                <option value="">Fərq etmir</option>
                {DURATION_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="max-w-lg mx-auto space-y-4">
          <p className="text-sm text-gray-400 text-center">
            Məlumatlarınız əsasında uyğun proqramlar axtarılacaq.
          </p>
          <dl className="rounded-xl border border-white/10 divide-y divide-white/10">
            {reviewSummary.map((row) => (
              <div key={row.label} className="flex justify-between gap-4 px-4 py-3 text-sm">
                <dt className="text-gray-500">{row.label}</dt>
                <dd className="text-white text-right">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 justify-between pt-2">
        <div className="flex gap-2">
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Bağla
            </Button>
          ) : null}
          {step > 1 ? (
            <Button type="button" variant="secondary" onClick={back}>
              Geri
            </Button>
          ) : null}
        </div>
        <div className="flex gap-2">
          {step < 5 ? (
            <Button type="button" onClick={next} disabled={!canNext()}>
              Növbəti
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => onSubmit?.({ state, params: wizardToSearchParams(state) })}
            >
              Proqramları axtar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
