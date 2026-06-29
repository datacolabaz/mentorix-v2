import { useTranslation } from 'react-i18next'
import { countryFlag } from '../../lib/universitySearch'

export default function ProgramResultsSummary({
  total,
  selectedCountries = [],
  countryCounts = {},
  coverageMessage,
  countriesWithResults = [],
}) {
  const { t } = useTranslation()

  if (!selectedCountries.length) return null

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      {coverageMessage ? (
        <p className="text-sm text-gray-300">{coverageMessage}</p>
      ) : null}

      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
          {t('universitySearch.results.selectedCountries')}
        </p>
        <div className="flex flex-wrap gap-2">
          {selectedCountries.map((country) => {
            const count = countryCounts[country] || 0
            const hasResults = count > 0
            return (
              <span
                key={country}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs border',
                  hasResults
                    ? 'border-primary/40 bg-primary/10 text-white'
                    : 'border-white/10 bg-black/20 text-gray-400',
                ].join(' ')}
              >
                <span aria-hidden>{countryFlag(country)}</span>
                <span>{country}</span>
                <span className={hasResults ? 'text-primary font-semibold' : 'text-gray-500'}>({count})</span>
              </span>
            )
          })}
        </div>
      </div>

      {countriesWithResults.length ? (
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
            {t('universitySearch.results.countriesWithResults')}
          </p>
          <p className="text-sm text-gray-300">
            {countriesWithResults.map((country) => `${countryFlag(country)} ${country}`).join(' · ')}
          </p>
        </div>
      ) : null}

      {total > 0 ? (
        <p className="text-xs text-gray-500">{t('universitySearch.results.filterPartialNote')}</p>
      ) : null}
    </div>
  )
}
