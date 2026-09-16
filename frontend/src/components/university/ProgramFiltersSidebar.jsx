import { useTranslation } from 'react-i18next'
import CountrySearchPicker from './CountrySearchPicker'
import FieldSearchPicker from './FieldSearchPicker'
import useUiStore from '../../hooks/useUi'

const inputCls = (light) =>
  light
    ? 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 [color-scheme:light] focus:outline-none focus:border-primary/50'
    : 'w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white [color-scheme:dark] focus:outline-none focus:border-primary/50'

function FilterCheckbox({ checked, onChange, label, light }) {
  return (
    <label className={['flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer', light ? 'border-slate-200 hover:border-slate-300' : 'border-white/10 hover:border-white/20'].join(' ')}>
      <input type="checkbox" className="accent-primary" checked={checked} onChange={onChange} />
      <span className={['text-sm', light ? 'text-slate-700' : 'text-white'].join(' ')}>{label}</span>
    </label>
  )
}

export default function ProgramFiltersSidebar({
  filters,
  onChange,
  onReset,
  countryCounts = null,
  qDraft,
  onQDraftChange,
}) {
  const { t } = useTranslation()
  const theme = useUiStore((s) => s.theme)
  const light = theme !== 'dark'
  const patch = (partial) => onChange({ ...filters, ...partial, page: 1 })

  return (
    <aside className={['lg:sticky lg:top-6 space-y-5 rounded-2xl border p-4 sm:p-5 h-fit max-h-[calc(100vh-2rem)] overflow-y-auto', light ? 'border-slate-200 bg-white shadow-sm' : 'border-white/10 bg-white/[0.03]'].join(' ')}>
      <div className="flex items-center justify-between gap-2">
        <h3 className={['font-display font-bold', light ? 'text-slate-900' : 'text-white'].join(' ')}>{t('universitySearch.filters.title')}</h3>
        <button type="button" onClick={onReset} className={['text-xs underline', light ? 'text-slate-500 hover:text-slate-900' : 'text-gray-400 hover:text-white'].join(' ')}>
          {t('universitySearch.actions.reset')}
        </button>
      </div>

      <div className="space-y-2">
        <label className={['text-[10px] font-bold uppercase tracking-wide', light ? 'text-slate-500' : 'text-gray-500'].join(' ')}>
          {t('universitySearch.filters.universityProgram')}
        </label>
        <input
          value={qDraft}
          onChange={(e) => onQDraftChange?.(e.target.value)}
          className={inputCls(light)}
          placeholder={t('universitySearch.filters.universityProgramPlaceholder')}
        />
        <p className={['text-[11px]', light ? 'text-slate-500' : 'text-gray-500'].join(' ')}>{t('universitySearch.filters.universityProgramHint')}</p>
      </div>

      <FieldSearchPicker
        value={filters.fields?.length ? filters.fields : filters.field}
        onChange={(fields) => patch({ fields: Array.isArray(fields) ? fields : [], field: '' })}
        label={t('universitySearch.filters.field')}
      />

      <CountrySearchPicker
        selected={filters.countries}
        onChange={(countries) => patch({ countries })}
        countryCounts={countryCounts}
        compact
        label={t('universitySearch.filters.countries')}
      />

      <div className="space-y-2">
        <label className={['text-[10px] font-bold uppercase tracking-wide', light ? 'text-slate-500' : 'text-gray-500'].join(' ')}>
          {t('universitySearch.filters.universityType')}
        </label>
        <select
          value={filters.university_type || ''}
          onChange={(e) => patch({ university_type: e.target.value })}
          className={inputCls(light)}
        >
          <option value="">{t('universitySearch.filters.all')}</option>
          <option value="Private">{t('universitySearch.filters.private')}</option>
          <option value="Public">{t('universitySearch.filters.public')}</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className={['text-[10px] font-bold uppercase tracking-wide', light ? 'text-slate-500' : 'text-gray-500'].join(' ')}>
          {t('universitySearch.filters.degree')}
        </label>
        <select
          value={filters.degree_level}
          onChange={(e) => patch({ degree_level: e.target.value })}
          className={inputCls(light)}
        >
          <option value="">{t('universitySearch.filters.all')}</option>
          <option value="BSc">{t('universitySearch.degrees.bscFull')}</option>
          <option value="MSc">{t('universitySearch.degrees.mscFull')}</option>
          <option value="PhD">{t('universitySearch.degrees.phdFull')}</option>
        </select>
      </div>

      <div className="space-y-2">
        <p className={['text-[10px] font-bold uppercase tracking-wide', light ? 'text-slate-500' : 'text-gray-500'].join(' ')}>
          {t('universitySearch.filters.powerFilters')}
        </p>
        <div className="space-y-2">
          <FilterCheckbox
            light={light}
            checked={filters.scholarship}
            onChange={(e) => patch({ scholarship: e.target.checked })}
            label={t('universitySearch.filters.scholarship')}
          />
          <FilterCheckbox
            light={light}
            checked={filters.english_only}
            onChange={(e) => patch({ english_only: e.target.checked, language: e.target.checked ? 'English' : '' })}
            label={t('universitySearch.filters.englishOnly')}
          />
          <FilterCheckbox
            light={light}
            checked={filters.no_ielts}
            onChange={(e) => patch({ no_ielts: e.target.checked })}
            label={t('universitySearch.filters.noIelts')}
          />
          <FilterCheckbox
            light={light}
            checked={filters.no_motivation}
            onChange={(e) => patch({ no_motivation: e.target.checked })}
            label={t('universitySearch.filters.noMotivation')}
          />
          <FilterCheckbox
            light={light}
            checked={filters.max_ranking === '500'}
            onChange={(e) => patch({ max_ranking: e.target.checked ? '500' : '' })}
            label={t('universitySearch.filters.qsTop500')}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className={['text-[10px] font-bold uppercase tracking-wide', light ? 'text-slate-500' : 'text-gray-500'].join(' ')}>
          {t('universitySearch.filters.minIelts')}
        </label>
        <input
          type="number"
          min="0"
          max="9"
          step="0.5"
          value={filters.user_ielts}
          onChange={(e) => patch({ user_ielts: e.target.value, no_ielts: false })}
          className={inputCls(light)}
          placeholder={t('universitySearch.filters.placeholderIelts')}
        />
      </div>

      <div className="space-y-2">
        <label className={['text-[10px] font-bold uppercase tracking-wide', light ? 'text-slate-500' : 'text-gray-500'].join(' ')}>
          {t('universitySearch.filters.minToefl')}
        </label>
        <input
          type="number"
          min="0"
          max="120"
          step="1"
          value={filters.user_toefl}
          onChange={(e) => patch({ user_toefl: e.target.value })}
          className={inputCls(light)}
          placeholder={t('universitySearch.filters.placeholderToefl')}
        />
      </div>

      <div className="space-y-2">
        <label className={['text-[10px] font-bold uppercase tracking-wide', light ? 'text-slate-500' : 'text-gray-500'].join(' ')}>
          {t('universitySearch.filters.maxTuition')}
        </label>
        <input
          type="number"
          min="0"
          step="100"
          value={filters.max_tuition}
          onChange={(e) => patch({ max_tuition: e.target.value })}
          className={inputCls(light)}
          placeholder={t('universitySearch.filters.placeholderTuition')}
        />
      </div>

      <div className="space-y-2">
        <label className={['text-[10px] font-bold uppercase tracking-wide', light ? 'text-slate-500' : 'text-gray-500'].join(' ')}>
          {t('universitySearch.filters.deadline')}
        </label>
        <input
          type="date"
          value={filters.deadline_before}
          onChange={(e) => patch({ deadline_before: e.target.value })}
          className={inputCls(light)}
        />
      </div>

      <div className="space-y-2">
        <label className={['text-[10px] font-bold uppercase tracking-wide', light ? 'text-slate-500' : 'text-gray-500'].join(' ')}>
          {t('universitySearch.filters.sort')}
        </label>
        <select value={filters.sort} onChange={(e) => patch({ sort: e.target.value })} className={inputCls(light)}>
          <option value="ranking">{t('universitySearch.filters.sortRanking')}</option>
          <option value="tuition_asc">{t('universitySearch.filters.sortTuitionAsc')}</option>
          <option value="tuition_desc">{t('universitySearch.filters.sortTuitionDesc')}</option>
          <option value="deadline">{t('universitySearch.filters.sortDeadline')}</option>
        </select>
      </div>
    </aside>
  )
}
