import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useActiveLocale from '../../hooks/useActiveLocale'
import { countryFlag } from '../../lib/universityCountries'
import { countryDisplayName, filterCountriesByQuery } from '../../lib/universityCountryI18n'
import useUiStore from '../../hooks/useUi'

const inputCls = (light) =>
  light
    ? 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary/50'
    : 'w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary/50'

export default function CountrySearchPicker({
  selected = [],
  onChange,
  countryCounts = null,
  label = null,
  compact = false,
}) {
  const { t } = useTranslation()
  const locale = useActiveLocale()
  const theme = useUiStore((s) => s.theme)
  const light = theme !== 'dark'
  const [query, setQuery] = useState('')

  const visibleCountries = useMemo(
    () => filterCountriesByQuery(query, locale),
    [query, locale],
  )

  const toggle = (country) => {
    const next = selected.includes(country)
      ? selected.filter((c) => c !== country)
      : [...selected, country]
    onChange?.(next)
  }

  const displayCountry = (country) => countryDisplayName(country, locale)

  return (
    <div className="space-y-2" key={`country-picker-${locale}`}>
      {label ? (
        <label className={['text-[10px] font-bold uppercase tracking-wide', light ? 'text-slate-500' : 'text-gray-500'].join(' ')}>{label}</label>
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
                className={['inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs', light ? 'text-slate-900' : 'text-white'].join(' ')}
              >
                <span aria-hidden>{countryFlag(country)}</span>
                <span>{displayCountry(country)}</span>
                {count != null ? <span className="text-primary font-semibold">({count})</span> : null}
                <span className={light ? 'text-slate-500' : 'text-gray-400'}>×</span>
              </button>
            )
          })}
        </div>
      ) : null}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={inputCls(light)}
        placeholder={t('universitySearch.picker.countrySearchPlaceholder')}
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
                  active
                    ? light
                      ? 'bg-primary/15 text-slate-900'
                      : 'bg-primary/15 text-white'
                    : light
                      ? 'text-slate-700 hover:bg-slate-100'
                      : 'text-gray-300 hover:bg-white/5',
                ].join(' ')}
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <span aria-hidden>{countryFlag(country)}</span>
                  <span className="truncate">{displayCountry(country)}</span>
                </span>
                <span className={['shrink-0 text-xs', light ? 'text-slate-500' : 'text-gray-500'].join(' ')}>
                  {active ? '✓' : null}
                  {count != null ? ` (${count})` : ''}
                </span>
              </button>
            )
          })
        ) : (
          <p className={['text-xs px-1 py-2', light ? 'text-slate-500' : 'text-gray-500'].join(' ')}>{t('universitySearch.picker.noCountryMatch')}</p>
        )}
      </div>
    </div>
  )
}
