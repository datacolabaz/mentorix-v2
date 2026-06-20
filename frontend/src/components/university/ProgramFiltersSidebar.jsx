import CountrySearchPicker from './CountrySearchPicker'
import FieldSearchPicker from './FieldSearchPicker'

const inputCls =
  'w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white [color-scheme:dark] focus:outline-none focus:border-primary/50'

function FilterCheckbox({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 cursor-pointer hover:border-white/20">
      <input type="checkbox" className="accent-primary" checked={checked} onChange={onChange} />
      <span className="text-sm text-white">{label}</span>
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
  const patch = (partial) => onChange({ ...filters, ...partial, page: 1 })

  return (
    <aside className="lg:sticky lg:top-6 space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 h-fit max-h-[calc(100vh-2rem)] overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display font-bold text-white">Filtrlər</h3>
        <button type="button" onClick={onReset} className="text-xs text-gray-400 hover:text-white underline">
          Sıfırla
        </button>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Universitet / proqram</label>
        <input
          value={qDraft}
          onChange={(e) => onQDraftChange?.(e.target.value)}
          className={inputCls}
          placeholder="Məs: Politecnico, Warsaw, Informatics"
        />
        <p className="text-[11px] text-gray-500">Universitet və ya proqram adının bir hissəsini yazın.</p>
      </div>

      <FieldSearchPicker
        value={filters.fields?.length ? filters.fields : filters.field}
        onChange={(fields) => patch({ fields: Array.isArray(fields) ? fields : [], field: '' })}
      />

      <CountrySearchPicker
        selected={filters.countries}
        onChange={(countries) => patch({ countries })}
        countryCounts={countryCounts}
        compact
      />

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Universitet tipi</label>
        <select
          value={filters.university_type || ''}
          onChange={(e) => patch({ university_type: e.target.value })}
          className={inputCls}
        >
          <option value="">Hamısı</option>
          <option value="Private">Xüsusi</option>
          <option value="Public">Dövlət</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Dərəcə</label>
        <select
          value={filters.degree_level}
          onChange={(e) => patch({ degree_level: e.target.value })}
          className={inputCls}
        >
          <option value="">Hamısı</option>
          <option value="BSc">BSc (Bakalavr)</option>
          <option value="MSc">MSc (Magistr)</option>
          <option value="PhD">PhD</option>
        </select>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Güclü filtrlər</p>
        <div className="space-y-2">
          <FilterCheckbox
            checked={filters.scholarship}
            onChange={(e) => patch({ scholarship: e.target.checked })}
            label="Təqaüd var"
          />
          <FilterCheckbox
            checked={filters.english_only}
            onChange={(e) => patch({ english_only: e.target.checked, language: e.target.checked ? 'English' : '' })}
            label="İngilis dili"
          />
          <FilterCheckbox
            checked={filters.no_ielts}
            onChange={(e) => patch({ no_ielts: e.target.checked })}
            label="IELTS tələb etmir"
          />
          <FilterCheckbox
            checked={filters.no_motivation}
            onChange={(e) => patch({ no_motivation: e.target.checked })}
            label="Motivasiya məktubu tələb etmir"
          />
          <FilterCheckbox
            checked={filters.max_ranking === '500'}
            onChange={(e) => patch({ max_ranking: e.target.checked ? '500' : '' })}
            label="QS top 500"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Min IELTS balınız</label>
        <input
          type="number"
          min="0"
          max="9"
          step="0.5"
          value={filters.user_ielts}
          onChange={(e) => patch({ user_ielts: e.target.value, no_ielts: false })}
          className={inputCls}
          placeholder="Məs: 6.5"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Min TOEFL balınız</label>
        <input
          type="number"
          min="0"
          max="120"
          step="1"
          value={filters.user_toefl}
          onChange={(e) => patch({ user_toefl: e.target.value })}
          className={inputCls}
          placeholder="Məs: 90"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Max təhsil haqqı (€/il)</label>
        <input
          type="number"
          min="0"
          step="100"
          value={filters.max_tuition}
          onChange={(e) => patch({ max_tuition: e.target.value })}
          className={inputCls}
          placeholder="Məs: 5000"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Son müraciət tarixi</label>
        <input
          type="date"
          value={filters.deadline_before}
          onChange={(e) => patch({ deadline_before: e.target.value })}
          className={inputCls}
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Sıralama</label>
        <select value={filters.sort} onChange={(e) => patch({ sort: e.target.value })} className={inputCls}>
          <option value="ranking">Dünya reytinqi</option>
          <option value="tuition_asc">Ödəniş (aşağı)</option>
          <option value="tuition_desc">Ödəniş (yuxarı)</option>
          <option value="deadline">Son tarix</option>
        </select>
      </div>
    </aside>
  )
}
