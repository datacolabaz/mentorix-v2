import { useMemo, useState } from 'react'
import { countryFlag, filterCountriesByQuery } from '../../lib/universityCountries'

const inputCls =
  'w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary/50'

export default function CountrySearchPicker({
  selected = [],
  onChange,
  countryCounts = null,
  label = 'Ölkələr',
  compact = false,
}) {
  const [query, setQuery] = useState('')

  const visibleCountries = useMemo(() => filterCountriesByQuery(query), [query])

  const toggle = (country) => {
    const next = selected.includes(country)
      ? selected.filter((c) => c !== country)
      : [...selected, country]
    onChange?.(next)
  }

  return (
    <div className="space-y-2">
      {label ? (
        <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</label>
      ) : null}

      {selected.length ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((country) => {
            const count = countryCounts?.[country]
            return (
              <button
                key={country}
                type="button"
                onClick={() => toggle(country)}
                className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-white"
              >
                <span aria-hidden>{countryFlag(country)}</span>
                <span>{country}</span>
                {count != null ? <span className="text-primary font-semibold">({count})</span> : null}
                <span className="text-gray-400">×</span>
              </button>
            )
          })}
        </div>
      ) : null}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={inputCls}
        placeholder="Ölkə axtar — məs: est, poland, almaniya"
      />

      <div className={compact ? 'max-h-40 overflow-y-auto space-y-1 pr-1' : 'max-h-52 overflow-y-auto space-y-1 pr-1'}>
        {visibleCountries.length ? (
          visibleCountries.map((country) => {
            const active = selected.includes(country)
            const count = countryCounts?.[country]
            return (
              <button
                key={country}
                type="button"
                onClick={() => toggle(country)}
                className={[
                  'w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                  active ? 'bg-primary/15 text-white' : 'text-gray-300 hover:bg-white/5',
                ].join(' ')}
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <span aria-hidden>{countryFlag(country)}</span>
                  <span className="truncate">{country}</span>
                </span>
                <span className="shrink-0 text-xs text-gray-500">
                  {active ? '✓' : null}
                  {count != null ? ` (${count})` : ''}
                </span>
              </button>
            )
          })
        ) : (
          <p className="text-xs text-gray-500 px-1 py-2">Uyğun ölkə tapılmadı.</p>
        )}
      </div>
    </div>
  )
}
