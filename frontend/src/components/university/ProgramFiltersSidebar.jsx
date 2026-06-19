import { MVP_COUNTRIES } from '../../lib/universitySearch'

const inputCls =
  'w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white [color-scheme:dark] focus:outline-none focus:border-primary/50'

export default function ProgramFiltersSidebar({ filters, onChange, onReset, countryCounts = null }) {
  const toggleCountry = (country) => {
    const next = filters.countries.includes(country)
      ? filters.countries.filter((c) => c !== country)
      : [...filters.countries, country]
    onChange({ ...filters, countries: next, page: 1 })
  }

  return (
    <aside className="lg:sticky lg:top-6 space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 h-fit">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display font-bold text-white">Filtrlər</h3>
        <button type="button" onClick={onReset} className="text-xs text-gray-400 hover:text-white underline">
          Sıfırla
        </button>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Axtarış</label>
        <input
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value, page: 1 })}
          className={inputCls}
          placeholder="Proqram və ya universitet"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Ölkələr</label>
        <div className="flex flex-wrap gap-2">
          {MVP_COUNTRIES.map((country) => {
            const active = filters.countries.includes(country)
            const count = countryCounts?.[country]
            const showCount = countryCounts && active
            return (
            <button
              key={country}
              type="button"
              onClick={() => toggleCountry(country)}
              className={[
                'rounded-full px-3 py-1.5 text-xs border transition-colors',
                active
                  ? 'border-primary bg-primary/15 text-white'
                  : 'border-white/10 text-gray-400 hover:border-white/25',
              ].join(' ')}
            >
              {country}
              {showCount ? (
                <span className={count > 0 ? ' text-primary font-semibold' : ' text-gray-500'}>
                  {' '}({count})
                </span>
              ) : null}
            </button>
            )
          })}
        </div>
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 cursor-pointer hover:border-white/20">
        <input
          type="checkbox"
          className="accent-primary"
          checked={filters.scholarship}
          onChange={(e) => onChange({ ...filters, scholarship: e.target.checked, page: 1 })}
        />
        <span className="text-sm text-white">Yalnız təqaüdlü (Təqaüd)</span>
      </label>

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Son müraciət tarixi</label>
        <input
          type="date"
          value={filters.deadline_before}
          onChange={(e) => onChange({ ...filters, deadline_before: e.target.value, page: 1 })}
          className={inputCls}
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Sıralama</label>
        <select
          value={filters.sort}
          onChange={(e) => onChange({ ...filters, sort: e.target.value, page: 1 })}
          className={inputCls}
        >
          <option value="ranking">Dünya reytinqi</option>
          <option value="tuition_asc">Ödəniş (aşağı)</option>
          <option value="tuition_desc">Ödəniş (yuxarı)</option>
          <option value="deadline">Son tarix</option>
        </select>
      </div>
    </aside>
  )
}
